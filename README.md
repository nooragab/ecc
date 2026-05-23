# ECC — Elliptic Curve Cryptography Simulator

An interactive web application that visualizes and simulates **Elliptic Curve Cryptography (ECC)** end-to-end — from key generation to encryption and decryption — powered by a real secp256k1 implementation in Python and a live 3D visualization engine built with Three.js.

---

## Features

- **Live 3D Curve Visualization** — Animated elliptic curve rendered in Three.js with orbiting spheres, named points (G, P, Q, R), and a travelling dot tracing the curve in real time
- **Step-by-step Key Generation** — Watch scalar multiplication (k × G) animated point-by-point on the curve as your keys are generated
- **Encrypt & Decrypt** — Full ECIES (Elliptic Curve Integrated Encryption Scheme) pipeline with visual walkthrough of every step
- **Guided Flow** — Progress bar locks steps in order (Learn → Key Gen → Encrypt → Decrypt) so users can't skip ahead
- **Educational Content** — Learn page with video, trapdoor function analogy, and an explainer on why ECC beats RSA
- **Curated Resources** — Videos, papers, standards (NIST, SEC), books, and implementation tools organized by category

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask, Flask-CORS |
| Cryptography | Custom secp256k1 implementation (`ecc_core.py`) |
| Frontend | Vanilla HTML/CSS/JS |
| 3D Rendering | Three.js r128 |
| Fonts | Syne, Space Grotesk, IBM Plex Mono |

---

## Cryptography Details

The cryptographic backend (`ecc_core.py`) implements a full **ECIES** scheme on the **secp256k1** curve (the same curve used by Bitcoin and Ethereum).

### Curve Parameters

```
y² = x³ + 7  (mod p)

p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667E..., 0x483ADA77...)
```

### Encryption Flow (ECIES)

```
1. Generate ephemeral keypair  (k_e, Q_e = k_e × G)
2. ECDH shared secret          S = k_e × PublicKey
3. KDF (SHA-512)               enc_key || mac_key = SHA-512("ECIES-secp256k1-v2" || S.x || S.y)
4. Encrypt                     ciphertext = XOR(plaintext, enc_key)
5. Authenticate (MAC)          mac = HMAC-SHA256(mac_key, ephemeral_pub || ciphertext)
6. Output                      { ephemeral_pub, ciphertext, mac }
```

### Decryption Flow

```
1. Decompress ephemeral public key
2. ECDH shared secret          S = PrivateKey × Q_e
3. Re-derive enc_key, mac_key  (same KDF)
4. Verify MAC                  constant-time compare — reject if mismatch
5. Decrypt                     plaintext = XOR(ciphertext, enc_key)
```

### Security Properties

- **Point validation** — every public key is checked against the curve equation before use
- **Compressed key format** — 33-byte (66 hex char) compressed points, standard Bitcoin encoding
- **Key separation** — SHA-512 KDF derives independent encryption and MAC keys from one shared secret
- **Encrypt-then-MAC** — integrity is verified before any decryption attempt, preventing padding/decryption oracles
- **Constant-time MAC comparison** — `hmac.compare_digest` prevents timing attacks
- **Iterative modular inverse** — no recursion risk on large inputs

---

## Getting Started

### Prerequisites

- Python 3.8+
- pip

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ecc-simulator.git
cd ecc-simulator

# Install dependencies
pip install flask flask-cors

# Run the server
python app.py
```

The app will be available at `http://localhost:5000`.

### Project Structure

```
ecc-simulator/
 app.py              # Flask routes (keygen, encrypt, decrypt)
 ecc_core.py         # secp256k1 curve + ECIES implementation
 templates/
    index.html      # Single-page application
 static/
     style.css        # Styling & animations
     script.js        # Three.js scenes + UI logic
     vid/            # (optional) local video assets
```

---

## How to Use

1. **Learn ECC** — Start with the Learn page to understand trapdoor functions and why elliptic curves matter
2. **Generate Keys** — Click *Generate My Keys* and watch the scalar multiplication animate live on the 3D curve
3. **Encrypt** — Type any message and hit *Encrypt & Send* — the 3D scene shows M, C₁, C₂ and the shared secret S being computed
4. **Decrypt** — Bob uses his private key to recover S and subtract it from C₂ to get M back
5. **Resources** — Browse curated papers, standards, and videos for deeper study

> The progress bar at the top locks each step until the previous one is complete, mirroring the real cryptographic dependency between the steps.

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Serve the frontend |
| `POST` | `/generate_keys` | Generate a new secp256k1 keypair |
| `POST` | `/encrypt` | Encrypt plaintext with a public key |
| `POST` | `/decrypt` | Decrypt ciphertext with a private key |

### `POST /generate_keys`

**Response**
```json
{
  "private_key": "0x1a2b3c...",
  "public_key": "02a3f7e9..."
}
```

### `POST /encrypt`

**Request**
```json
{
  "plaintext": "Hello ECC!",
  "public_key": "02a3f7e9..."
}
```

**Response**
```json
{
  "ciphertext": "{\"ephemeral_pub\": \"03...\", \"ciphertext\": \"f3a2...\", \"mac\": \"8b1d...\"}"
}
```

### `POST /decrypt`

**Request**
```json
{
  "ciphertext": "{\"ephemeral_pub\": \"03...\", \"ciphertext\": \"f3a2...\", \"mac\": \"8b1d...\"}",
  "private_key": "0x1a2b3c..."
}
```

**Response**
```json
{
  "plaintext": "Hello ECC!"
}
```

---

## Disclaimer

This project is built for **educational purposes**. The XOR stream cipher used here is not suitable for production — a real ECIES implementation would use AES-GCM or ChaCha20-Poly1305. The secp256k1 math is correct, but the overall scheme is intentionally simplified to keep the visualization clear and the code readable.

---

## Further Reading

- [NIST SP 800-186](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-186.pdf) — Recommendations for Discrete Logarithm-Based Cryptography
- [SEC 1 Standard](https://www.secg.org/sec1-v2.pdf) — Standards for Efficient Cryptography
- [SafeCurves](https://safecurves.cr.yp.to/) — Security evaluation of elliptic curves
- [Guide to ECC — Hankerson, Menezes, Vanstone](https://link.springer.com/book/10.1007/b97644) — The definitive textbook

---
