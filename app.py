from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
from ecc_core import ECCSystem

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

ecc = ECCSystem()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate_keys', methods=['POST'])
def generate_keys():
    """Generate new keys"""
    private_key, public_key = ecc.generate_keypair()
    return jsonify({
        'private_key': private_key,
        'public_key': public_key
    })

@app.route('/encrypt', methods=['POST'])
def encrypt():
    """Encrypt text"""
    data = request.json
    plaintext = data.get('plaintext', '')
    public_key = data.get('public_key', '')
    
    if not plaintext or not public_key:
        return jsonify({'error': 'Plaintext and public key are required'}), 400
    
    try:
        ciphertext = ecc.encrypt(plaintext, public_key)
        return jsonify({'ciphertext': ciphertext})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/decrypt', methods=['POST'])
def decrypt():
    """Decrypt text"""
    data = request.json
    ciphertext = data.get('ciphertext', '')
    private_key = data.get('private_key', '')
    
    if not ciphertext or not private_key:
        return jsonify({'error': 'Ciphertext and private key are required'}), 400
    
    try:
        plaintext = ecc.decrypt(ciphertext, private_key)
        return jsonify({'plaintext': plaintext})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
