const mongoose = require('mongoose');
const User = require('./src/models/User');

const test = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/tap2help');
        const user = await User.findOne({ email: 'priyanshuwrath@gmail.com' });
        if (!user) {
            console.log('User not found');
            return;
        }
        const token = user.getSignedJwtToken();
        
        const payload = {
            title: 'Test Title 123',
            description: 'Test Description 12345',
            category: 'Moving Help',
            urgency: 'Medium',
            coordinates: [-74.006, 40.7128],
            address: '123 Test St',
            creditValue: 25,
            paymentType: 'credits'
        };
        
        console.log('Sending payload:', payload);
        const res = await fetch('http://localhost:5001/api/requests', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
        });
        
        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch(err) {
        console.log('Error:', err.message);
    }
    process.exit(0);
};
test();
