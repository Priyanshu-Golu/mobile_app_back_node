const mongoose = require('mongoose');
const User = require('./src/models/User');

mongoose.connect('mongodb://localhost:27017/tap2help').then(async () => {
    try {
        const aggs = User.aggregate([
            { $unwind: { path: '$userId', preserveNullAndEmptyArrays: false } }
        ]);
        console.log('Mongoose Pipeline Output:', JSON.stringify(aggs.pipeline()));
    } catch(err) {
        console.log('Error:', err.message);
    }
    process.exit(0);
});
