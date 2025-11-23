import csv
import pickle
import os
from datetime import datetime

def convert_csv_to_dict(csv_file_path):
    keys = ['USD', 'JPY', 'BGN', 'CZK', 'DKK', 'GBP', 'HUF', 'PLN', 'RON', 'SEK', 'CHF', 'ISK', 'NOK', 'TRY',
            'BRL', 'CAD', 'CNY', 'HKD', 'IDR', 'ILS', 'INR', 'KRW', 'MXN', 'MYR', 'NZD', 'PHP', 'SGD', 'THB']

    result_dict = {}

    with open(csv_file_path, mode='r') as file:
        csv_reader = csv.reader(file)
        header = next(csv_reader)  # Skip the header
        for row in csv_reader:
            # Convert date to 'YYYY-MM-DD' format
            date = datetime.strptime(row[0], '%d %B %Y').strftime('%Y-%m-%d')
            values = row[1:]
            currency_data = {keys[i]: float(values[i]) for i in range(len(keys)) if values[i] != 'N/A'}
            result_dict[date] = currency_data

    return result_dict

# Absolute path to the script's directory
SCRIPT_DIR = "/home/matat99/portfolio_mgr/code/databases"

# Change to the script's directory
os.chdir(SCRIPT_DIR)

# Load existing data
try:
    with open('ecb_daily.pkl', 'rb') as file:
        existing_data = pickle.load(file)
except FileNotFoundError:
    existing_data = {}  # If the file doesn't exist, start with an empty dictionary

# Convert new CSV data to a dictionary
csv_file_path = 'eurofxref.csv'  # The CSV file should be in the same directory
new_data = convert_csv_to_dict(csv_file_path)
print(new_data)

# Update existing data with new data
existing_data.update(new_data)

# Save the updated data back to the .pkl file
with open('ecb_daily.pkl', 'wb') as file:
    pickle.dump(existing_data, file)
