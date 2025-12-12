import hashlib
import secrets
import json

class EllipticCurve:
    """Elliptic curve secp256k1 used in Bitcoin"""
    def __init__(self):
        # Curve parameters y^2 = x^3 + 7 (mod p)
        self.p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
        self.a = 0
        self.b = 7
        self.G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
                  0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)
        self.n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    
    def mod_inverse(self, a, m):
        """Calculate modular inverse"""
        if a < 0:
            a = (a % m + m) % m
        g, x, _ = self.extended_gcd(a, m)
        if g != 1:
            raise Exception('Inverse does not exist')
        return x % m
    
    def extended_gcd(self, a, b):
        """Extended Euclidean algorithm"""
        if a == 0:
            return b, 0, 1
        gcd, x1, y1 = self.extended_gcd(b % a, a)
        x = y1 - (b // a) * x1
        y = x1
        return gcd, x, y
    
    def point_add(self, P, Q):
        """Add two points on the curve"""
        if P is None:
            return Q
        if Q is None:
            return P
        
        x1, y1 = P
        x2, y2 = Q
        
        if x1 == x2:
            if y1 == y2:
                return self.point_double(P)
            else:
                return None
        
        # Calculate slope
        slope = ((y2 - y1) * self.mod_inverse(x2 - x1, self.p)) % self.p
        
        # Calculate new point
        x3 = (slope * slope - x1 - x2) % self.p
        y3 = (slope * (x1 - x3) - y1) % self.p
        
        return (x3, y3)
    
    def point_double(self, P):
        """Double a point on the curve"""
        if P is None:
            return None
        
        x, y = P
        
        # Calculate slope
        slope = ((3 * x * x + self.a) * self.mod_inverse(2 * y, self.p)) % self.p
        
        # Calculate new point
        x3 = (slope * slope - 2 * x) % self.p
        y3 = (slope * (x - x3) - y) % self.p
        
        return (x3, y3)
    
    def scalar_multiply(self, k, P):
        """Multiply a point by an integer (k * P)"""
        if k == 0:
            return None
        if k < 0:
            raise ValueError('k must be positive')
        
        result = None
        addend = P
        
        while k:
            if k & 1:
                result = self.point_add(result, addend)
            addend = self.point_double(addend)
            k >>= 1
        
        return result


class ECCSystem:
    def __init__(self):
        self.curve = EllipticCurve()
    
    def generate_keypair(self):
        """Generate a key pair (private, public)"""
        # Private key: random number
        private_key = secrets.randbelow(self.curve.n - 1) + 1
        
        # Public key: private_key * G
        public_key = self.curve.scalar_multiply(private_key, self.curve.G)
        
        return (hex(private_key), 
                f"{hex(public_key[0])}:{hex(public_key[1])}")
    
    def _kdf(self, shared_secret):
        """Derive a key from the shared secret"""
        # Use SHA-256 to generate a 32-byte key
        # Convert integer to bytes deterministically (32 bytes = 256 bits)
        if not isinstance(shared_secret, int):
            raise ValueError("Shared secret must be a valid integer")
        return hashlib.sha256(shared_secret.to_bytes(32, 'big')).digest()
    
    def _xor_encrypt(self, data, key):
        """XOR encryption with key repetition"""
        result = bytearray()
        key_len = len(key)
        for i, byte in enumerate(data):
            result.append(byte ^ key[i % key_len])
        return bytes(result)
    
    def encrypt(self, plaintext, public_key_str):
        """Encrypt text using ECIES"""
        # Convert public key from string
        try:
            x_str, y_str = public_key_str.split(':')
            public_key = (int(x_str, 16), int(y_str, 16))
        except ValueError:
            raise ValueError("Invalid public key format")
        
        # Generate random ephemeral key
        ephemeral_private = secrets.randbelow(self.curve.n - 1) + 1
        ephemeral_public = self.curve.scalar_multiply(ephemeral_private, self.curve.G)
        
        # Compute shared secret
        shared_point = self.curve.scalar_multiply(ephemeral_private, public_key)
        if shared_point is None:
            raise ValueError("Invalid shared secret derived (Point at Infinity)")
            
        shared_secret = shared_point[0]
        
        # Derive encryption key
        encryption_key = self._kdf(shared_secret)
        
        # Encrypt data
        plaintext_bytes = plaintext.encode('utf-8')
        ciphertext = self._xor_encrypt(plaintext_bytes, encryption_key)
        
        # Combine result: ephemeral_public + ciphertext
        result = {
            'ephemeral_x': hex(ephemeral_public[0]),
            'ephemeral_y': hex(ephemeral_public[1]),
            'ciphertext': ciphertext.hex()
        }
        
        return json.dumps(result)
    
    def decrypt(self, ciphertext_json, private_key_str):
        """Decrypt using ECIES"""
        # Parse encrypted data
        data = json.loads(ciphertext_json)
        ephemeral_public = (int(data['ephemeral_x'], 16), int(data['ephemeral_y'], 16))
        ciphertext = bytes.fromhex(data['ciphertext'])
        
        # Convert private key
        private_key = int(private_key_str, 16)
        
        # Compute shared secret
        shared_point = self.curve.scalar_multiply(private_key, ephemeral_public)
        if shared_point is None:
            raise ValueError("Invalid shared secret derived (Point at Infinity)")
            
        shared_secret = shared_point[0]
        
        # Derive encryption key
        encryption_key = self._kdf(shared_secret)
        
        # Decrypt
        plaintext_bytes = self._xor_encrypt(ciphertext, encryption_key)
        
        return plaintext_bytes.decode('utf-8')
