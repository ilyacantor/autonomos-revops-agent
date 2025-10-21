"""
Slack Alert Utility
Sends human-in-the-loop escalation alerts to Slack
"""

import os
import requests
import json
from datetime import datetime

class SlackAlerter:
    def __init__(self):
        self.webhook_url = os.getenv('SLACK_WEBHOOK_URL', '')
    
    def send_alert(self, message, channel=None, username="Pipeline Health Monitor"):
        """
        Send a message to Slack
        
        Args:
            message (str or dict): Message to send
            channel (str): Optional channel override
            username (str): Bot username
            
        Returns:
            bool: Success status
        """
        if not self.webhook_url:
            print("Slack webhook URL not configured")
            return False
        
        # Build payload
        payload = {
            "username": username,
            "icon_emoji": ":robot_face:"
        }
        
        if channel:
            payload["channel"] = channel
        
        if isinstance(message, str):
            payload["text"] = message
        else:
            payload.update(message)
        
        try:
            response = requests.post(
                self.webhook_url,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Slack alert error: {e}")
            return False
    
    def send_bant_violation_alert(self, violation):
        """Send formatted BANT violation alert"""
        message = {
            "text": "🚨 *CRM Integrity Alert: BANT Violation Detected*",
            "attachments": [
                {
                    "color": "danger",
                    "fields": [
                        {
                            "title": "Opportunity",
                            "value": violation.get('opportunity_name', 'Unknown'),
                            "short": True
                        },
                        {
                            "title": "Stage",
                            "value": violation.get('stage', 'Unknown'),
                            "short": True
                        },
                        {
                            "title": "Issues Found",
                            "value": "\n".join([f"• {issue}" for issue in violation.get('issues', [])]),
                            "short": False
                        },
                        {
                            "title": "Action Required",
                            "value": violation.get('action_required', 'Review immediately'),
                            "short": False
                        }
                    ],
                    "footer": "Pipeline Health Monitor - CRM Integrity Workflow",
                    "ts": int(datetime.now().timestamp())
                }
            ]
        }
        
        return self.send_alert(message)
    
    def send_pipeline_risk_alert(self, deal):
        """Send formatted pipeline risk alert"""
        risk_level = "🔴 HIGH" if deal['Risk Score'] > 70 else "🟡 MEDIUM"
        
        message = {
            "text": f"{risk_level} *Pipeline Risk Alert*",
            "attachments": [
                {
                    "color": "warning" if deal['Risk Score'] > 70 else "good",
                    "fields": [
                        {
                            "title": "Opportunity",
                            "value": deal.get('Opportunity Name', 'Unknown'),
                            "short": True
                        },
                        {
                            "title": "Account",
                            "value": deal.get('Account Name', 'Unknown'),
                            "short": True
                        },
                        {
                            "title": "Risk Score",
                            "value": f"{deal['Risk Score']:.1f}/100",
                            "short": True
                        },
                        {
                            "title": "Health Score",
                            "value": f"{deal['Health Score']}/100",
                            "short": True
                        },
                        {
                            "title": "Last Activity",
                            "value": f"{deal.get('Last Login (days)', 'N/A')} days ago",
                            "short": True
                        },
                        {
                            "title": "Amount",
                            "value": f"${deal.get('Amount', 0):,}",
                            "short": True
                        },
                        {
                            "title": "Recommendation",
                            "value": deal.get('Recommendation', 'Review required'),
                            "short": False
                        }
                    ],
                    "footer": "Pipeline Health Monitor - Pipeline Health Workflow",
                    "ts": int(datetime.now().timestamp())
                }
            ]
        }
        
        return self.send_alert(message)
    
    def send_batch_alerts(self, items, alert_type='bant'):
        """Send multiple alerts in batch"""
        success_count = 0
        
        for item in items:
            if alert_type == 'bant':
                if self.send_bant_violation_alert(item):
                    success_count += 1
            elif alert_type == 'pipeline':
                if self.send_pipeline_risk_alert(item):
                    success_count += 1
        
        return success_count
