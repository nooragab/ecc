
try:
    from ecc_core import ECCSystem
    print("Initializing ECCSystem...")
    ecc = ECCSystem()
    print("Generating keypair...")
    priv, pub = ecc.generate_keypair()
    print("Success!")
    print(f"Private: {priv}")
    print(f"Public: {pub}")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
