const mongoose = require('mongoose');

const fixIndexes = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/tap2help');
        const db = mongoose.connection.db;
        const collection = db.collection('helprequests');
        
        const indexes = await collection.indexes();
        console.log("Current indexes:");
        indexes.forEach(idx => {
            console.log(`- Name: ${idx.name}, Key:`, idx.key);
        });

        // Find 2dsphere indexes
        const geoIndexes = indexes.filter(idx => 
            Object.values(idx.key).includes('2dsphere')
        );

        if (geoIndexes.length > 1) {
            console.log("\nFound multiple 2dsphere indexes!");
            // the new correct one is { location: '2dsphere' }.
            // we should drop anything that is NOT location: 2dsphere
            for (const idx of geoIndexes) {
                if (idx.name !== 'location_2dsphere') {
                    console.log(`Dropping old index: ${idx.name}`);
                    await collection.dropIndex(idx.name);
                }
            }
            console.log("Indexes fixed successfully.");
        } else {
            console.log("\nNo duplicate 2dsphere indexes found.");
        }
    } catch(err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

fixIndexes();
