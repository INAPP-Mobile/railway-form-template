import smtplib
import logging
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


async def send_via_sendgrid(name: str, email: str, message: str) -> bool:
    if not settings.sendgrid_api_key:
        logger.info("SendGrid API key not configured, skipping SendGrid")
        return False
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        sg = sendgrid.SendGridAPIClient(api_key=settings.sendgrid_api_key)
        mail = Mail(
            from_email=Email(settings.from_email),
            to_emails=To(settings.form_recipient_email or email),
            subject=f"New contact form submission from {name}",
            html_content=Content(
                "text/html",
                f"<p><strong>Name:</strong> {name}</p>"
                f"<p><strong>Email:</strong> {email}</p>"
                f"<p><strong>Message:</strong></p><p>{message}</p>",
            ),
        )
        response = sg.send(mail)
        logger.info("SendGrid response status: %s", response.status_code)
        return 200 <= response.status_code < 300
    except Exception as e:
        logger.error("SendGrid send failed: %s", e)
        return False


async def send_via_smtp(name: str, email: str, message: str) -> bool:
    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_pass]):
        logger.info("SMTP not fully configured, skipping")
        return False
    try:
        body = (
            f"New contact form submission\n\n"
            f"Name: {name}\n"
            f"Email: {email}\n"
            f"Message:\n{message}\n"
        )
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = f"New contact form submission from {name}"
        msg["From"] = settings.from_email
        msg["To"] = settings.form_recipient_email or email

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
        logger.info("SMTP email sent successfully")
        return True
    except Exception as e:
        logger.error("SMTP send failed: %s", e)
        return False


async def send_notification(name: str, email: str, message: str) -> bool:
    sg_ok = await send_via_sendgrid(name, email, message)
    if sg_ok:
        return True
    smtp_ok = await send_via_smtp(name, email, message)
    return smtp_ok
