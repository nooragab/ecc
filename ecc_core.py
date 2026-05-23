import hashlib
import hmac
import secrets
import json


class EllipticCurve:
    """Elliptic curve secp256k1 — y² = x³ + 7 (mod p)"""

    def __init__(self):
        self.p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
        self.a = 0
        self.b = 7
        self.G = (
            0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
            0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8,
        )
        self.n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141

    # ------------------------------------------------------------------
    # IMPROVEMENT 1: Point validation
    #   الكود الأصلي كان بيقبل أي نقطة من غير ما يتحقق إنها على المنحنى.
    #   لو حد بعت public key مش على المنحنى، الـ ECDH بيكسر.
    # ------------------------------------------------------------------
    def is_on_curve(self, P):
        """Verify that point P lies on the curve y² ≡ x³ + b (mod p)."""
        if P is None:
            return True  # Point at infinity is valid
        x, y = P
        lhs = (y * y) % self.p
        rhs = (pow(x, 3, self.p) + self.b) % self.p
        return lhs == rhs

    def validate_point(self, P, name="Point"):
        """Raise if P is not a valid curve point."""
        if not self.is_on_curve(P):
            raise ValueError(f"{name} is not on the curve secp256k1")

    # ------------------------------------------------------------------
    # IMPROVEMENT 2: Iterative extended_gcd instead of recursive
    #   الكود الأصلي كان بيستخدم recursion — آمن لـ secp256k1 (عمق ~370)
    #   لكن الـ iterative أوضح، أسرع، ومفيش خطر stack overflow.
    # ------------------------------------------------------------------
    def mod_inverse(self, a, m):
        """Modular inverse via iterative extended Euclidean algorithm."""
        a = a % m
        if a < 0:
            a += m
        old_r, r = a, m
        old_s, s = 1, 0
        while r != 0:
            q = old_r // r
            old_r, r = r, old_r - q * r
            old_s, s = s, old_s - q * s
        if old_r != 1:
            raise ValueError(f"Modular inverse does not exist for {a} mod {m}")
        return old_s % m

    def point_add(self, P, Q):
        """Add two points on the curve."""
        if P is None:
            return Q
        if Q is None:
            return P

        x1, y1 = P
        x2, y2 = Q

        if x1 == x2:
            return self.point_double(P) if y1 == y2 else None

        slope = ((y2 - y1) * self.mod_inverse(x2 - x1, self.p)) % self.p
        x3 = (slope * slope - x1 - x2) % self.p
        y3 = (slope * (x1 - x3) - y1) % self.p
        return (x3, y3)

    def point_double(self, P):
        """Double a point on the curve."""
        if P is None:
            return None
        x, y = P
        slope = ((3 * x * x + self.a) * self.mod_inverse(2 * y, self.p)) % self.p
        x3 = (slope * slope - 2 * x) % self.p
        y3 = (slope * (x - x3) - y) % self.p
        return (x3, y3)

    def scalar_multiply(self, k, P):
        """Double-and-add scalar multiplication: compute k * P."""
        if k == 0:
            return None
        if k < 0:
            raise ValueError("k must be a positive integer")
        result = None
        addend = P
        while k:
            if k & 1:
                result = self.point_add(result, addend)
            addend = self.point_double(addend)
            k >>= 1
        return result

    # ------------------------------------------------------------------
    # IMPROVEMENT 3: Compressed point serialization
    #   الكود الأصلي كان بيحتاج إرسال x و y الاتنين (64 bytes).
    #   الـ compressed format بيبعت x بس + prefix bit (33 bytes) — معيار Bitcoin.
    # ------------------------------------------------------------------
    def compress_point(self, P):
        """Serialize point as 33-byte compressed hex (02/03 prefix)."""
        if P is None:
            raise ValueError("Cannot compress point at infinity")
        x, y = P
        prefix = "02" if y % 2 == 0 else "03"
        return prefix + hex(x)[2:].zfill(64)

    def decompress_point(self, compressed_hex):
        """Deserialize a compressed point back to (x, y)."""
        if len(compressed_hex) != 66:
            raise ValueError("Compressed point must be 66 hex characters")
        prefix = compressed_hex[:2]
        if prefix not in ("02", "03"):
            raise ValueError(f"Invalid compressed point prefix: {prefix}")
        x = int(compressed_hex[2:], 16)
        # Recover y: y² = x³ + 7 (mod p), then pick even/odd
        y_sq = (pow(x, 3, self.p) + self.b) % self.p
        y = pow(y_sq, (self.p + 1) // 4, self.p)  # Works because p ≡ 3 (mod 4)
        if (y % 2 == 0) != (prefix == "02"):
            y = self.p - y
        P = (x, y)
        self.validate_point(P, "Decompressed point")
        return P


class ECCSystem:
    def __init__(self):
        self.curve = EllipticCurve()

    def generate_keypair(self):
        """Generate (private_key_hex, compressed_public_key_hex)."""
        private_key = secrets.randbelow(self.curve.n - 1) + 1
        public_key = self.curve.scalar_multiply(private_key, self.curve.G)
        return (
            hex(private_key),
            self.curve.compress_point(public_key),   # compressed: 66 chars
        )

    # ------------------------------------------------------------------
    # IMPROVEMENT 4: HKDF-style KDF (SHA-256 with context label)
    #   الكود الأصلي: SHA-256(shared_secret_bytes) — بسيط لكن ما فيش context.
    #   الـ improved: بيضيف "label" في الـ hash لعزل مفاتيح التشفير عن
    #   أي استخدام تاني للـ shared secret (key separation).
    # ------------------------------------------------------------------
    def _kdf(self, shared_secret_x: int, shared_secret_y: int) -> bytes:
        """
        Derive 32-byte encryption key + 32-byte MAC key from shared point.
        Uses both coordinates and a domain label for key separation.
        """
        material = (
            b"ECIES-secp256k1-v2"
            + shared_secret_x.to_bytes(32, "big")
            + shared_secret_y.to_bytes(32, "big")
        )
        digest = hashlib.sha512(material).digest()  # 64 bytes
        enc_key = digest[:32]   # first 32 bytes → encryption
        mac_key = digest[32:]   # last  32 bytes → MAC
        return enc_key, mac_key

    def _xor_encrypt(self, data: bytes, key: bytes) -> bytes:
        """XOR stream cipher with key repetition."""
        key_len = len(key)
        return bytes(b ^ key[i % key_len] for i, b in enumerate(data))

    def encrypt(self, plaintext: str, public_key_hex: str) -> str:
        """
        Encrypt using ECIES with HMAC-SHA256 integrity check.

        Output JSON fields:
          ephemeral_pub  — compressed ephemeral public key (66 hex chars)
          ciphertext     — XOR-encrypted message (hex)
          mac            — HMAC-SHA256 over (ephemeral_pub + ciphertext)
        """
        # --- IMPROVEMENT 3 applied: deserialize compressed public key ---
        try:
            public_key = self.curve.decompress_point(public_key_hex)
        except Exception:
            # Fallback: try legacy x:y format for backward compatibility
            try:
                x_str, y_str = public_key_hex.split(":")
                public_key = (int(x_str, 16), int(y_str, 16))
                # IMPROVEMENT 1: validate even if legacy format
                self.curve.validate_point(public_key, "Public key")
            except ValueError:
                raise ValueError("Invalid public key format (expected compressed hex or x:y)")

        # Generate ephemeral keypair
        ephemeral_private = secrets.randbelow(self.curve.n - 1) + 1
        ephemeral_public  = self.curve.scalar_multiply(ephemeral_private, self.curve.G)

        # ECDH shared secret
        shared_point = self.curve.scalar_multiply(ephemeral_private, public_key)
        if shared_point is None:
            raise ValueError("Shared secret is point at infinity — invalid public key")

        # IMPROVEMENT 4: derive two separate keys
        enc_key, mac_key = self._kdf(shared_point[0], shared_point[1])

        # Encrypt
        plaintext_bytes = plaintext.encode("utf-8")
        ciphertext_bytes = self._xor_encrypt(plaintext_bytes, enc_key)

        ephemeral_pub_hex = self.curve.compress_point(ephemeral_public)
        ciphertext_hex    = ciphertext_bytes.hex()

        # ------------------------------------------------------------------
        # IMPROVEMENT 5: HMAC-SHA256 for integrity (Encrypt-then-MAC)
        #   الكود الأصلي ما كانش عنده أي integrity check — أي تعديل على الـ
        #   ciphertext كان بيعدي من غير ما يتكشف.
        #   دلوقتي: HMAC على (ephemeral_pub + ciphertext) بالـ mac_key.
        # ------------------------------------------------------------------
        mac_input = (ephemeral_pub_hex + ciphertext_hex).encode("ascii")
        mac = hmac.new(mac_key, mac_input, hashlib.sha256).hexdigest()

        return json.dumps({
            "ephemeral_pub": ephemeral_pub_hex,
            "ciphertext":    ciphertext_hex,
            "mac":           mac,
        })

    def decrypt(self, ciphertext_json: str, private_key_hex: str) -> str:
        """
        Decrypt and verify integrity. Raises on tampered ciphertext or wrong key.
        """
        try:
            data = json.loads(ciphertext_json)
            ephemeral_pub_hex = data["ephemeral_pub"]
            ciphertext_hex    = data["ciphertext"]
            received_mac      = data["mac"]
        except (KeyError, json.JSONDecodeError) as e:
            raise ValueError(f"Malformed ciphertext packet: {e}")

        # IMPROVEMENT 3: decompress ephemeral public key + validate it
        try:
            ephemeral_public = self.curve.decompress_point(ephemeral_pub_hex)
        except ValueError as e:
            raise ValueError(f"Invalid ephemeral public key: {e}")

        private_key = int(private_key_hex, 16)

        # ECDH
        shared_point = self.curve.scalar_multiply(private_key, ephemeral_public)
        if shared_point is None:
            raise ValueError("Shared secret is point at infinity")

        enc_key, mac_key = self._kdf(shared_point[0], shared_point[1])

        # ------------------------------------------------------------------
        # IMPROVEMENT 5: Verify MAC before decrypting (fail fast, no oracle)
        # ------------------------------------------------------------------
        mac_input   = (ephemeral_pub_hex + ciphertext_hex).encode("ascii")
        expected_mac = hmac.new(mac_key, mac_input, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(received_mac, expected_mac):
            raise ValueError("Decryption failed: MAC verification error (wrong key or tampered ciphertext)")

        ciphertext_bytes = bytes.fromhex(ciphertext_hex)
        plaintext_bytes  = self._xor_encrypt(ciphertext_bytes, enc_key)

        try:
            return plaintext_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("Decryption failed: could not decode plaintext (wrong key?)")