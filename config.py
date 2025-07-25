import os

# Database configuration
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'db'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', 'yourpassword'),
    'database': os.getenv('MYSQL_DB', 'crud_db'),
    'port': 3306
}

# Other configurations
COUNTRIES_API_URL = "https://restcountries.com/v3.1/all"