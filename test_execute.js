const mongoose = require('mongoose');
const HelpRequest = require('./src/models/HelpRequest');
const User = require('./src/models/User'); // ensure registered

mongoose.connect('mongodb://localhost:27017/tap2help').then(async () => {
    try {
        const aggs = await HelpRequest.aggregate([
            { $unwind: { path: '$userId', preserveNullAndEmptyArrays: false } }
        ]);
        console.log('Success! Got', aggs.length, 'results');
    } catch(err) {
        console.log('Error From MongoDB:', err.message);
    }
    process.exit(0);
});
