function fetchDronopadData(url) {
  console.log('Starting fetchDronopadData function for URL:', url);
  try {
    console.log('Fetching Airtable data...');
    const airtableData = fetchAirtableData();
    console.log('Airtable data fetched successfully:', JSON.stringify(airtableData));

    console.log('Fetching CBA API data...');
    const cbaApiData = fetchCBAApiData();
    console.log('CBA API data fetched successfully:', JSON.stringify(cbaApiData));
    
    const result = {
      amount: airtableData.currentAmount + cbaApiData.amount,
      equipmentDelivered: airtableData.equipmentDelivered,
      wingsDowned: airtableData.wingsDowned,
      transferredFPV: airtableData.transferredFPV,
      transferredPickups: airtableData.transferredPickups,
      ZALA: airtableData.ZALA,
      Orlan: airtableData.Orlan,
      Supercam: airtableData.Supercam,
      totalDronesDowned: airtableData.ZALA + airtableData.Supercam + airtableData.Orlan
    };
    
    console.log('Combined Dronopad data:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('Error in fetchDronopadData:', error);
    throw error;
  }
}

function fetchAirtableData() {
  console.log('Starting fetchAirtableData function');
  const personalAccessToken = 'AIRTABLE BEARER TOKEN'; //YOUR AIRTABLE BEARER TOKEN
  const baseId = 'BASEID'; //YOUR AIRTABLE BASEID
  const tableName = 'TABLE_NAME'; // YOUR AIRTABLE TABLE NAME
  const fetchUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?view=Grid%20view`;

  console.log('Fetching data from Airtable URL:', fetchUrl);

  try {
    const response = UrlFetchApp.fetch(fetchUrl, {
      headers: {
        'Authorization': `Bearer ${personalAccessToken}`
      }
    });
    
    console.log('Airtable API response received');
    const data = JSON.parse(response.getContentText());
    
    if (data.records && data.records.length > 0) {
      console.log('Airtable data parsed successfully');
      const fields = data.records[0].fields;
      const result = {
        currentAmount: parseInt(fields['Сurrent amount']),
        equipmentDelivered: parseFloat(fields['Equipment delivered']),
        wingsDowned: parseInt(fields['Wings downed']),
        transferredFPV: parseInt(fields['Transf. (FPV)']),
        transferredPickups: parseInt(fields['Transf. (Pickups)']),
        ZALA: parseInt(fields['ZALA']),
        Orlan: parseInt(fields['Orlan']),
        Supercam: parseInt(fields['Supercam'])
      };
      console.log('Processed Airtable data:', JSON.stringify(result));
      return result;
    } else {
      console.error('No records found in Airtable or the first column is empty');
      throw new Error('No records found in Airtable or the first column is empty.');
    }
  } catch (error) {
    console.error('Error fetching data from Airtable:', error);
    throw error;
  }
}

function fetchCBAApiData() {
  console.log('Starting fetchCBAApiData function');
  const url = ''; //CBA ENDPOINT URL for particular project
  
  console.log('Fetching data from CBA API URL:', url);

  try {
    const response = UrlFetchApp.fetch(url);
    console.log('CBA API response received');
    const data = JSON.parse(response.getContentText());
    
    if (data.length > 0 && data[0].total_amount) {
      const result = {
        amount: parseInt(data[0].total_amount)
      };
      console.log('Processed CBA API data:', JSON.stringify(result));
      return result;
    } else {
      console.error('total_amount not found in the CBA API response');
      throw new Error('total_amount not found in the CBA API response');
    }
  } catch (error) {
    console.error('Error fetching data from CBA API:', error);
    throw error;
  }
}