"""이메일 채널 발송 (R-SCH-30, Q-019). SMTP 환경변수(SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM) 없으면 result='skipped:no_smtp' 로 마감."""
from __future__ import annotations
import os, smtplib
from email.message import EmailMessage
from .db.postgres import PostgresDB

def send_pending(db: PostgresDB, limit: int = 200, dry_run: bool = False) -> dict:
    rows = db.read_df("""select n.id, n.title, n.body, p.email from app.notification n join app.profiles p on p.user_id = n.recipient
        where n.channel = 'email' and n.sent_at is null order by n.created_at limit %s""", (limit,))
    # 이메일 발송 off (D-046): 대기 행은 '건너뜀' 으로 마감해 다시 켰을 때 과거 알림이 몰려 나가지 않게
    en = db.read_df("select coalesce((select value::text from app.system_settings where key = 'notify_email_enabled'), 'true') as v")
    if not rows.empty and str(en.iloc[0, 0]).strip('"') == "false":
        db.execute("update app.notification set sent_at = now(), result = 'skipped:disabled' where id = any(%s)", (list(int(i) for i in rows.id),))
        return {"sent": 0, "skipped": int(len(rows)), "failed": 0}
    host = os.environ.get("SMTP_HOST")
    sent = skipped = failed = 0
    if rows.empty:
        return {"sent": 0, "skipped": 0, "failed": 0}
    if not host or dry_run:
        ids = tuple(rows["id"].tolist())
        db.execute("update app.notification set sent_at = now(), result = %s where id = any(%s)", ("skipped:no_smtp" if not host else "dry_run", list(ids)))
        return {"sent": 0, "skipped": len(ids), "failed": 0}
    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587"))) as s:
        s.starttls()
        if os.environ.get("SMTP_USER"):
            s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASS", ""))
        for r in rows.itertuples():
            try:
                m = EmailMessage(); m["Subject"] = f"[SCMpro] {r.title}"; m["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER")); m["To"] = r.email
                m.set_content(r.body or r.title); s.send_message(m)
                db.execute("update app.notification set sent_at = now(), result = 'sent' where id = %s", (int(r.id),)); sent += 1
            except Exception as e:
                db.execute("update app.notification set sent_at = now(), result = %s where id = %s", (f"failed:{e}"[:200], int(r.id))); failed += 1
    return {"sent": sent, "skipped": skipped, "failed": failed}
