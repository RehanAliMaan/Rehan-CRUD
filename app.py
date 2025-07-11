from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
import mysql.connector
from mysql.connector import Error
from config import DB_CONFIG, COUNTRIES_API_URL

app = Flask(__name__)
CORS(app)


# Database connection with error handling
def create_db_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        print("✅ MySQL Connection Successful!")
        return connection
    except Error as e:
        print(f"❌ MySQL Connection Failed: {e}")
        print(f"❌ Attempted connection with config: { {k:v for k,v in DB_CONFIG.items() if k != 'password'} }")
        return None
def create_db_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        print("✅ MySQL Connection Successful!")
        return connection
    except Error as e:
        print(f"❌ MySQL Connection Failed: {e}")
        return None

# Initialize database tables
def init_db():
    connection = create_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS locations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    country VARCHAR(255) NOT NULL,
                    state VARCHAR(255),
                    city VARCHAR(255),
                    latitude DECIMAL(10, 8),
                    longitude DECIMAL(11, 8),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)
            connection.commit()
            print("✅ Database initialized successfully")
        except Error as e:
            print(f"❌ Error initializing database: {e}")
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()

init_db()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# API Endpoints
@app.route('/api/countries', methods=['GET'])
def get_countries():
    try:
        response = requests.get(f"{COUNTRIES_API_URL}/countries", timeout=10)
        response.raise_for_status()
        data = response.json()
        return jsonify([{'name': c['country'], 'iso2': c['iso2']} for c in data['data']])
    except Exception as e:
        print(f"❌ Countries API error: {e}")
        return jsonify({'error': "Failed to fetch countries"}), 500

@app.route('/api/states', methods=['POST'])
def get_states():
    if not request.json or 'country' not in request.json:
        return jsonify({'error': "Country is required"}), 400
    
    try:
        response = requests.post(
            f"{COUNTRIES_API_URL}/countries/states",
            json={'country': request.json['country']},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        states = data.get('data', {}).get('states', [])
        return jsonify([state['name'] for state in states])
    except Exception as e:
        print(f"❌ States API error: {e}")
        return jsonify({'error': "Failed to fetch states"}), 500

@app.route('/api/cities', methods=['POST'])
def get_cities():
    if not request.json or not all(k in request.json for k in ['country', 'state']):
        return jsonify({'error': "Country and state are required"}), 400
    
    try:
        response = requests.post(
            f"{COUNTRIES_API_URL}/countries/state/cities",
            json={'country': request.json['country'], 'state': request.json['state']},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        return jsonify(data.get('data', []))
    except Exception as e:
        print(f"❌ Cities API error: {e}")

           
# CRUD Endpoints
@app.route('/api/locations/<int:location_id>', methods=['GET'])
def get_location(location_id):
    connection = create_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM locations WHERE id = %s", (location_id,))
        location = cursor.fetchone()
        
        if not location:
            return jsonify({'error': 'Location not found'}), 404
            
        return jsonify(location)
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()
@app.route('/api/locations', methods=['GET'])
def get_locations():
    connection = create_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM locations ORDER BY created_at DESC")
        results = cursor.fetchall()
        return jsonify(results)
    except Error as e:
        print(f"❌ Database error: {e}")
        return jsonify({'error': "Database error"}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

app.route('/api/locations', methods=['POST'])
def create_location():
    print("Received data:", request.get_json())  
@app.route('/api/locations', methods=['POST'])
def create_location():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data received'}), 400
            
        required_fields = ['name', 'country']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Name and country are required'}), 400
        
        connection = create_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            cursor = connection.cursor()
            query = """
                INSERT INTO locations 
                (name, description, country, state, city, latitude, longitude) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                data['name'],
                data.get('description', ''),
                data['country'],
                data.get('state', ''),
                data.get('city', ''),
                data.get('latitude'),
                data.get('longitude')
            )
            
            cursor.execute(query, values)
            connection.commit()
            
            return jsonify({
                'id': cursor.lastrowid,
                'message': 'Location created successfully'
            }), 201
        except Error as e:
            print(f"❌ Database error: {e}")
            return jsonify({'error': str(e)}), 500
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return jsonify({'error': str(e)}), 500
@app.route('/api/locations/<int:location_id>', methods=['PUT'])
def update_location(location_id):
    try:
        data = request.get_json()
        
        connection = create_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First get current data
        cursor.execute("SELECT * FROM locations WHERE id = %s", (location_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Location not found'}), 404
        
        # Build update query
        query = """
            UPDATE locations 
            SET name = %s, 
                description = %s,
                country = %s,
                state = %s,
                city = %s,
                latitude = %s,
                longitude = %s
            WHERE id = %s
        """
        values = (
            data.get('name'),
            data.get('description'),
            data.get('country'),
            data.get('state'),
            data.get('city'),
            data.get('latitude'),
            data.get('longitude'),
            location_id
        )
        
        cursor.execute(query, values)
        connection.commit()
        
        return jsonify({'message': 'Location updated successfully'}), 200
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/locations/<int:location_id>', methods=['DELETE'])
def delete_location(location_id):
    try:
        connection = create_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("DELETE FROM locations WHERE id = %s", (location_id,))
        connection.commit()
        
        return jsonify({'message': 'Location deleted successfully'}), 200
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, port=3000)

  