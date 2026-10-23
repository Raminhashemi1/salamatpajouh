# قرارداد API پیشنهادی — مستقر نشده

- `GET /api/billing/prices?currency=IRR|USD|EUR` : فقط نرخ تاییدشده سرور در کوچک‌ترین واحد (IRR ریال، USD/EUR سنت).
- `POST /api/billing/quote` : نشست معتبر؛ فقط `{currency,targetGroupDeclared}`. سرور اشتراک و تعرفه را دوباره می‌خواند، `{kind,discountPercent,amountMinor,eligible}` برمی‌گرداند. مبلغ ارسالی از کاربر پذیرفته نمی‌شود.
- `POST /api/payments/start` : نشست، CSRF، rate limit و idempotency key؛ سرور سفارش pending را ایجاد می‌کند؛ بدون پذیرنده تاییدشده پاسخ `503 PAYMENTS_NOT_CONFIGURED` می‌دهد.
- `GET|POST /api/payments/callback/{provider}` : صرفاً نشانه‌ای برای استعلام سرور به سرور؛ مطابقت provider، authority، currency، amount و reference ضروری است.
- `GET /api/payments/orders/{id}` : فقط صاحب سفارش، بدون افشای کلید/اطلاعات کارت.

**امنیت:** انتقال pending به paid و تمدید عضویت باید در یک تراکنش دیتابیس انجام شود؛ تکرار callback یا دو بار درخواست start نباید دوبار حق عضویت ایجاد کند. اطلاعات کارت فقط توسط صفحه رسمی درگاه دریافت شود. قیمت USD/EUR از نرخ IRR حدس زده نشود.

این سند جایگزین مشخصات اختصاصی درگاه و توافق تجاری نیست.
