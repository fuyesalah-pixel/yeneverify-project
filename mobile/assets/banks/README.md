# assets/banks/

Bank logo assets used by `BankLogo` widget.

## Required files
Each file is a PNG, named by lowercase bank code.

| File             | Bank                        | Status   |
|------------------|-----------------------------|----------|
| `cbe.png`        | Commercial Bank of Ethiopia | Required |
| `telebirr.png`   | Telebirr                    | Required |
| `awash.png`      | Awash Bank                  | Required |
| `dashen.png`     | Dashen Bank                 | Required |
| `abyssinia.png`  | Bank of Abyssinia           | Required |
| `mpesa.png`      | M-Pesa (Safaricom)          | Required |
| `zemen.png`      | Zemen Bank                  | Required |

## Rules
- PNG format, square or landscape, transparent background preferred.
- Max size: 64×64px @2x (128×128 actual file). Larger = bundle bloat.
- Do NOT hotlink bank logos from external URLs.
- If a bank logo is missing, `BankLogo` falls back to initials automatically.
- Add new bank logos here when new bank adapters are added in Step 6+.
