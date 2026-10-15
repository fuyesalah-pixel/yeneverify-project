# fixtures/receipt-images/

Tiny test images (≤ 10 KB each) used for:
- Integration tests that need a real JPEG to upload
- `SEED_UPLOAD_FIXTURES=true` mode that pushes fixtures to local MinIO

## Required files (not committed — generate or download manually)

| File | Bank | Description |
|------|------|-------------|
| `cbe-sample.jpg` | CBE | Fake CBE receipt with reference FT26195DBK5W81465291 |
| `telebirr-sample.jpg` | Telebirr | Fake Telebirr receipt with reference DEV6HKJX7K |
| `awash-sample.jpg` | Awash | Fake Awash receipt with reference 2KEX10DJ7F-575JQI |
| `dashen-sample.jpg` | Dashen | Fake Dashen receipt |
| `abyssinia-sample.jpg` | Abyssinia | Fake Abyssinia receipt |
| `mpesa-sample.jpg` | M-Pesa | Fake M-Pesa receipt |
| `zemen-sample.jpg` | Zemen | Fake Zemen receipt |

## Generating test images

```bash
# Requires ImageMagick
convert -size 400x600 xc:white \
  -font Helvetica -pointsize 14 \
  -annotate +20+40 "Commercial Bank of Ethiopia" \
  -annotate +20+70 "Ref: FT26195DBK5W81465291" \
  -annotate +20+100 "Amount: ETB 550.00" \
  fixtures/receipt-images/cbe-sample.jpg
```

## Rules
- All images are fake — no real transaction data
- Max 10 KB each (only used in tests — not for OCR accuracy)
- Never commit real bank receipt images
- These files are gitignored (see .gitignore) except this README
