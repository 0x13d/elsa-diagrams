export const SAMPLE_WORKFLOW = `{
  "id": "doc-approval",
  "definitionId": "doc-approval",
  "name": "Document Approval",
  "version": 1,
  "isPublished": true,
  "isLatest": true,
  "root": {
    "id": "Flowchart1",
    "type": "Elsa.Flowchart",
    "activities": [
      {
        "id": "HttpEndpoint1",
        "type": "Elsa.Http.HttpEndpoint",
        "displayName": "Receive Document",
        "description": "Inbound request that kicks off the approval workflow.",
        "properties": {
          "Path": { "type": "Literal", "value": "/documents/submit" },
          "Methods": { "type": "Literal", "value": "POST" },
          "ReadContent": { "type": "Literal", "value": true },
          "Authorize": { "type": "Literal", "value": true }
        }
      },
      {
        "id": "If1",
        "type": "Elsa.If",
        "displayName": "Check Approval",
        "properties": {
          "Condition": {
            "type": "JavaScript",
            "value": "input.amount <= 5000 && input.department === 'engineering'"
          }
        }
      },
      {
        "id": "Sequence1",
        "type": "Elsa.Sequence",
        "displayName": "Approval Path",
        "activities": [
          {
            "id": "Email1",
            "type": "Elsa.Email.SendEmail",
            "displayName": "Notify Approver",
            "properties": {
              "From": { "type": "Literal", "value": "no-reply@thirteendelta.com" },
              "To": { "type": "JavaScript", "value": "input.approverEmail" },
              "Subject": { "type": "Liquid", "value": "Approval needed for {{ document.title }}" },
              "Body": {
                "type": "Liquid",
                "value": "Hi {{ approver.firstName }},\\n\\nPlease review {{ document.title }} ({{ document.url }}) before {{ document.deadline | date }}."
              }
            }
          },
          {
            "id": "Signal1",
            "type": "Elsa.Primitives.SignalReceived",
            "displayName": "Wait for Decision",
            "properties": {
              "Signal": { "type": "Literal", "value": "approval.decision" }
            }
          }
        ]
      },
      {
        "id": "HttpResponse1",
        "type": "Elsa.Http.WriteHttpResponse",
        "displayName": "Send Rejection",
        "properties": {
          "StatusCode": { "type": "Literal", "value": 403 },
          "ContentType": { "type": "Literal", "value": "application/json" },
          "Content": {
            "type": "JavaScript",
            "value": "JSON.stringify({ ok: false, reason: 'Outside auto-approval policy.' })"
          }
        }
      }
    ],
    "connections": [
      { "source": "HttpEndpoint1", "target": "If1", "sourcePort": "Done", "targetPort": "In" },
      { "source": "If1", "target": "Sequence1", "sourcePort": "True", "targetPort": "In" },
      { "source": "If1", "target": "HttpResponse1", "sourcePort": "False", "targetPort": "In" }
    ]
  }
}`;
