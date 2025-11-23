import pickle

# Load the data from the .pkl file
with open('ecb_daily.pkl', 'rb') as file:
    data = pickle.load(file)

# Get the last 3 entries from the dictionary
last_3_entries = dict(list(data.items())[-3:])

# Print the last 3 entries
print(last_3_entries)
