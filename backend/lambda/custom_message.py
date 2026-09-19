"""
CampusFind - Cognito CustomMessage Lambda Trigger
Renders responsive HTML emails for student verification codes,
password resets, and notifications to ensure high inbox deliverability.
"""

def lambda_handler(event, context):
    trigger_source = event.get('triggerSource', '')
    user_attrs = event.get('request', {}).get('userAttributes', {})
    code = event.get('request', {}).get('codeParameter', '{####}')
    name = user_attrs.get('name') or user_attrs.get('email', 'Student').split('@')[0]
    email = user_attrs.get('email', '')

    if trigger_source in ['CustomMessage_SignUp', 'CustomMessage_ResendCode']:
        event['response']['emailSubject'] = 'FindIt VITC - Your Student Account Verification Code'
        event['response']['emailMessage'] = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FindIt VITC Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1d4ed8; padding: 24px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">FindIt VITC</h1>
                    <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 12px;">VIT Chennai Lost &amp; Found + Emergency Broadcast Network</p>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.5px;">AWS Verified</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
                Hello <strong>{name}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">
                Thank you for registering with <strong>FindIt VITC</strong>. Please use the 6-digit confirmation code below to verify your student email address and activate your campus account:
              </p>

              <!-- Verification Code Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f1f5f9; border: 2px dashed #93c5fd; border-radius: 12px; padding: 18px 24px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #2563eb; margin-bottom: 6px;">Your 6-Digit Confirmation Code</div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">{code}</div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 20px; color: #64748b;">
                This code is valid for 24 hours. Enter it directly on the <a href="https://finditvitc.github.io" style="color: #2563eb; text-decoration: none; font-weight: 600;">FindIt VITC portal</a> to complete your registration.
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin: 24px 0 0 0;">
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #991b1b;">
                  <strong>Security Note:</strong> Never share this code with anyone. FindIt VITC administrators will never ask for your verification code or password. If you did not initiate this request, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                FindIt VITC • Vellore Institute of Technology, Chennai
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Vandalur-Kelambakkam Road, Chennai, Tamil Nadu 600127<br>
                <a href="https://finditvitc.github.io" style="color: #2563eb; text-decoration: none;">https://finditvitc.github.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    elif trigger_source == 'CustomMessage_ForgotPassword':
        event['response']['emailSubject'] = 'FindIt VITC - Password Reset Code'
        event['response']['emailMessage'] = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FindIt VITC Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1d4ed8; padding: 24px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">FindIt VITC</h1>
                    <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 12px;">VIT Chennai Lost &amp; Found + Emergency Broadcast Network</p>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.5px;">Password Reset</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
                Hello <strong>{name}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">
                We received a request to reset the password for your FindIt VITC student account (<strong>{email}</strong>). Please use the 6-digit recovery code below:
              </p>

              <!-- Reset Code Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f1f5f9; border: 2px dashed #93c5fd; border-radius: 12px; padding: 18px 24px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #2563eb; margin-bottom: 6px;">Password Reset Code</div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">{code}</div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 20px; color: #64748b;">
                Enter this code on the <a href="https://finditvitc.github.io" style="color: #2563eb; text-decoration: none; font-weight: 600;">FindIt VITC portal</a> to choose your new password.
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin: 24px 0 0 0;">
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #991b1b;">
                  <strong>Security Note:</strong> If you did not request a password reset, please change your password immediately or contact campus administrators.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                FindIt VITC • Vellore Institute of Technology, Chennai
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Vandalur-Kelambakkam Road, Chennai, Tamil Nadu 600127<br>
                <a href="https://finditvitc.github.io" style="color: #2563eb; text-decoration: none;">https://finditvitc.github.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return event
