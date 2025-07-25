// Global variables
let map;
let markers = [];
let selectedMarker = null;
let selectedLocationId = null;

document.addEventListener('DOMContentLoaded', function() {
    try {
        initMap();
        loadCountries();
        setupEventListeners();
        loadLocations();
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Application failed to initialize. Please check console for details.');
    }
});

function initMap() {
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function(e) {
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }
        selectedMarker = L.marker(e.latlng, {
            draggable: true
        }).addTo(map)
        .bindPopup("Selected Location")
        .openPopup();

        document.getElementById('coordinatesDisplay').textContent = 
            `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;

        selectedMarker.on('dragend', function(event) {
            const marker = event.target;
            const position = marker.getLatLng();
            document.getElementById('coordinatesDisplay').textContent = 
                `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        });
    });
}

function loadCountries() {
    fetch('/api/countries')
        .then(response => response.json())
        .then(countries => {
            const select = document.getElementById('country');
            select.innerHTML = '<option value="">Select Country</option>';
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.name;
                option.textContent = country.name;
                select.appendChild(option);
            });
        });
}

function setupEventListeners() {
    document.getElementById('country').addEventListener('change', function() {
        const country = this.value;
        const stateSelect = document.getElementById('state');
        
        stateSelect.innerHTML = '<option value="">Select State</option>';
        stateSelect.disabled = !country;
        
        if (country) {
            fetch('/api/states', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ country })
            })
            .then(response => response.json())
            .then(states => {
                states.forEach(state => {
                    const option = document.createElement('option');
                    option.value = state;
                    option.textContent = state;
                    stateSelect.appendChild(option);
                });
                stateSelect.disabled = false;
            });
        }
        
        document.getElementById('city').innerHTML = '<option value="">Select City</option>';
        document.getElementById('city').disabled = true;
    });

    document.getElementById('state').addEventListener('change', function() {
        const country = document.getElementById('country').value;
        const state = this.value;
        const citySelect = document.getElementById('city');
        
        citySelect.innerHTML = '<option value="">Select City</option>';
        citySelect.disabled = !state;
        
        if (state) {
            fetch('/api/cities', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ country, state })
            })
            .then(response => response.json())
            .then(cities => {
                cities.forEach(city => {
                    const option = document.createElement('option');
                    option.value = city;
                    option.textContent = city;
                    citySelect.appendChild(option);
                });
                citySelect.disabled = false;
            });
        }
    });

    document.getElementById('saveBtn').addEventListener('click', saveLocation);
    document.getElementById('updateBtn').addEventListener('click', updateLocation);
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
}

function saveLocation() {
    const name = prompt("Enter location name:");
    if (!name) return;

    const country = document.getElementById('country').value;
    if (!country) {
        alert('Country is required');
        return;
    }

    const state = document.getElementById('state').value;
    const city = document.getElementById('city').value;
    
    // Get coordinates
    let lat, lng;
    if (selectedMarker) {
        const coords = selectedMarker.getLatLng();
        lat = coords.lat;
        lng = coords.lng;
    } else {
        const coordsText = document.getElementById('coordinatesDisplay').textContent;
        if (coordsText.includes(',')) {
            [lat, lng] = coordsText.split(',').map(coord => parseFloat(coord.trim()));
        } else {
            alert('Please select a location on the map');
            return;
        }
    }
    fetch('/api/locations', {
    // ... existing code
})
.then(response => {
    if (!response.ok) {
        return response.json().then(err => Promise.reject(err));
    }
    return response.json();
})
.then(data => {
    if (data.error) {
        throw new Error(data.error);
    }
    alert(data.message);
    loadLocations();
    resetForm();
})
.catch(error => {
    console.error('Full error:', error);
    alert(`Failed to save location: ${error.message}`);
});

    fetch('/api/locations', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            name,
            country,
            state,
            city,
            latitude: lat,
            longitude: lng
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadLocations();
        resetForm();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to save location');
    });
}

function loadLocations() {
    fetch('/api/locations')
        .then(response => response.json())
        .then(locations => {
            const tableBody = document.getElementById('locationsTable');
            tableBody.innerHTML = '';
            clearMarkers();
            
            locations.forEach(location => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${location.name}</td>
                    <td>${formatLocation(location)}</td>
                    <td>${formatCoordinates(location)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editLocation(${location.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteLocation(${location.id})">Delete</button>
                    </td>
                `;
                
                tableBody.appendChild(row);
                
                if (location.latitude && location.longitude) {
                    addMarker(
                        { lat: location.latitude, lng: location.longitude },
                        `<b>${location.name}</b><br>${formatLocation(location)}`
                    );
                }
            });
        });
}

function editLocation(id) {
    fetch(`/api/locations/${id}`)
        .then(response => response.json())
        .then(location => {
            selectedLocationId = location.id;
            
            // Fill form
            document.getElementById('country').value = location.country;
            
            // Trigger state loading
            const event = new Event('change');
            document.getElementById('country').dispatchEvent(event);
            
            // Set state and city after a delay to allow loading
            setTimeout(() => {
                document.getElementById('state').value = location.state || '';
                const citySelect = document.getElementById('city');
                if (location.state) {
                    const cityEvent = new Event('change');
                    document.getElementById('state').dispatchEvent(cityEvent);
                    
                    setTimeout(() => {
                        citySelect.value = location.city || '';
                    }, 500);
                }
                
                // Set coordinates
                if (location.latitude && location.longitude) {
                    if (selectedMarker) {
                        map.removeLayer(selectedMarker);
                    }
                    selectedMarker = L.marker(
                        [location.latitude, location.longitude],
                        { draggable: true }
                    ).addTo(map)
                    .bindPopup("Selected Location")
                    .openPopup();
                    
                    document.getElementById('coordinatesDisplay').textContent = 
                        `${location.latitude}, ${location.longitude}`;
                }
                
                // Show update button, hide save button
                document.getElementById('saveBtn').style.display = 'none';
                document.getElementById('updateBtn').style.display = 'block';
                document.getElementById('cancelBtn').style.display = 'block';
            }, 500);
        });
}

function updateLocation() {
    if (!selectedLocationId) return;

    const name = prompt("Enter location name:");
    if (!name) return;

    const country = document.getElementById('country').value;
    if (!country) {
        alert('Country is required');
        return;
    }

    const state = document.getElementById('state').value;
    const city = document.getElementById('city').value;
    
    // Get coordinates
    let lat, lng;
    if (selectedMarker) {
        const coords = selectedMarker.getLatLng();
        lat = coords.lat;
        lng = coords.lng;
    } else {
        const coordsText = document.getElementById('coordinatesDisplay').textContent;
        if (coordsText.includes(',')) {
            [lat, lng] = coordsText.split(',').map(coord => parseFloat(coord.trim()));
        } else {
            alert('Please select a location on the map');
            return;
        }
    }

    fetch(`/api/locations/${selectedLocationId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            name,
            country,
            state,
            city,
            latitude: lat,
            longitude: lng
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadLocations();
        resetForm();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to update location');
    });
}

function deleteLocation(id) {
    if (confirm('Are you sure you want to delete this location?')) {
        fetch(`/api/locations/${id}`, { method: 'DELETE' })
        .then(response => {
            if (response.ok) {
                loadLocations();
            } else {
                alert('Failed to delete location');
            }
        });
    }
}

function cancelEdit() {
    resetForm();
}

function resetForm() {
    document.getElementById('country').value = '';
    document.getElementById('state').value = '';
    document.getElementById('state').disabled = true;
    document.getElementById('city').value = '';
    document.getElementById('city').disabled = true;
    document.getElementById('coordinatesDisplay').textContent = 'Click on map to select';
    
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    
    document.getElementById('saveBtn').style.display = 'block';
    document.getElementById('updateBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
    selectedLocationId = null;
}

function addMarker(coords, popupText) {
    const marker = L.marker([coords.lat, coords.lng])
        .addTo(map)
        .bindPopup(popupText);
    markers.push(marker);
    return marker;
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function formatLocation(location) {
    return [location.city, location.state, location.country]
        .filter(Boolean)
        .join(', ');
}

function formatCoordinates(location) {
    if (location.latitude && location.longitude) {
        return `${location.latitude}, ${location.longitude}`;
    }
    return 'Not set';
}

// Make functions available globally
window.editLocation = editLocation;
window.deleteLocation = deleteLocation;