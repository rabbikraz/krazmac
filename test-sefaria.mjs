// Test Sefaria search API - simpler version
const testText = "שלשה דברים מקצרים";

async function testSearch() {
    // Try the search-filter API
    const url = `https://www.sefaria.org/api/search-filter?q=${encodeURIComponent(testText)}&size=5&applied_filters=[]`;
    console.log("Trying search-filter API...");

    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response length:", text.length);
        console.log("First 500 chars:", text.substring(0, 500));
    } catch (e) {
        console.log("Error:", e.message);
    }

    // Try elastic search directly 
    console.log("\n\nTrying elastic search...");
    const esUrl = 'https://www.sefaria.org/api/search/text/_search';
    try {
        const res = await fetch(esUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: {
                    match: {
                        "naive_lemmatizer": testText
                    }
                },
                size: 5
            })
        });
        console.log("ES Status:", res.status);
        const data = await res.json();
        if (data.hits?.hits) {
            console.log("Found", data.hits.hits.length, "hits");
            data.hits.hits.forEach((hit, i) => {
                console.log(`Hit ${i + 1}: ${hit._source?.ref}`);
            });
        } else {
            console.log("Response:", JSON.stringify(data).substring(0, 500));
        }
    } catch (e) {
        console.log("ES Error:", e.message);
    }
}

testSearch().catch(console.error);
