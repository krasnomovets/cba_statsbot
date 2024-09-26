// Existing constants
const DATAWRAPPER_API_TOKEN = 'YOUR_API_TOKEN';
const DATAWRAPPER_CHART_ID = 'YOUR_CHART_ID';

function refreshDatawrapperChartData() {
  const url = `https://api.datawrapper.de/v3/charts/${DATAWRAPPER_CHART_ID}/publish`;
  const options = {
    'method': 'post',
    'headers': {
      'Authorization': `Bearer ${DATAWRAPPER_API_TOKEN}`,
      'accept': '*/*'
    },
    'muteHttpExceptions': true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const contentText = response.getContentText();
    
    console.log(`Republish response code: ${responseCode}`);
    console.log(`Republish response content: ${contentText}`);
    
    if (responseCode === 200) {
      console.log('Datawrapper chart republished successfully');
      return true;
    } else {
      console.error(`Failed to republish Datawrapper chart. Response Code: ${responseCode}`);
      console.error(`Response Content: ${contentText}`);
      return false;
    }
  } catch (error) {
    console.error('Error in refreshDatawrapperChartData:', error);
    return false;
  }
}

function updateChartAndGetPNG(newValue, date) {
  const maxAttempts = 3;
  const waitTime = 10000; // 10 seconds
  const folderId = 'YOUR_FOLDER_ID'; // Your specific folder ID

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Attempt ${attempt}/${maxAttempts} to update chart and get PNG`);

    if (refreshDatawrapperChartData()) {
      console.log(`Waiting after republish (Attempt ${attempt})...`);
      Utilities.sleep(waitTime);

      if (verifyChartDataUpdate(newValue, date)) {
        const pngBlob = getDatawrapperPNG();
        if (pngBlob) {
          const fileName = Utilities.formatDate(new Date(), 'GMT', 'MM-dd-yy') + '.png';
          pngBlob.setName(fileName);
          
          try {
            const folder = DriveApp.getFolderById(folderId);
            const file = folder.createFile(pngBlob);
            const fileId = file.getId();
            const pngUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
            console.log(`PNG URL (Attempt ${attempt}):`, pngUrl);
            console.log('File saved as:', fileName);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            return pngUrl;
          } catch (error) {
            console.error(`Error saving file to Drive (Attempt ${attempt}):`, error);
            if (attempt === maxAttempts) {
              const file = DriveApp.createFile(pngBlob);
              const fileId = file.getId();
              const pngUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
              console.log(`PNG URL (saved to root, Attempt ${attempt}):`, pngUrl);
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              return pngUrl;
            }
          }
        } else {
          console.log(`Failed to get PNG blob (Attempt ${attempt})`);
        }
      } else {
        console.log(`Data not updated in chart (Attempt ${attempt}), retrying...`);
      }
    } else {
      console.log(`Failed to republish chart (Attempt ${attempt})`);
    }

    if (attempt < maxAttempts) {
      console.log(`Waiting before next attempt...`);
      Utilities.sleep(waitTime);
    }
  }

  console.error("Failed to update chart and get PNG after multiple attempts");
  return null;
}

function verifyChartDataUpdate(newValue, date) {
  const chartData = getChartDataFromDatawrapper();
  if (chartData) {
    const rows = chartData.split('\n');
    for (let row of rows) {
      const [rowDate, _, rowValue] = row.split(',');
      if (rowDate === formatDate(date) && Math.abs(parseFloat(rowValue) - newValue) < 0.01) {
        console.log("Chart data verified as updated");
        return true;
      }
    }
  }
  console.log("Chart data not yet updated");
  return false;
}

function getChartDataFromDatawrapper() {
  const url = `https://api.datawrapper.de/v3/charts/${DATAWRAPPER_CHART_ID}/data`;
  const options = {
    'method': 'get',
    'headers': {
      'Authorization': `Bearer ${DATAWRAPPER_API_TOKEN}`,
    },
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return response.getContentText();
    } else {
      console.error('Failed to get chart data from Datawrapper');
      return null;
    }
  } catch (error) {
    console.error('Error getting chart data:', error);
    return null;
  }
}

function formatDate(date) {
  return Utilities.formatDate(date, 'GMT', 'dd/MM/yyyy');
}

function getDatawrapperPNG() {
  const params = {
    'unit': 'px',
    'mode': 'rgb',
    'width': 400,
    'height': 'auto',
    'plain': false,
    'scale': 1,
    'zoom': 2,
    'borderWidth': 10,
    'download': false,
    'fullVector': false,
    'ligatures': true,
    'transparent': false,
    'logo': 'off',
    'dark': false
  };
  
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const url = `https://api.datawrapper.de/v3/charts/${DATAWRAPPER_CHART_ID}/export/png?${queryString}`;
  const options = {
    'method': 'get',
    'headers': {
      'Authorization': `Bearer ${DATAWRAPPER_API_TOKEN}`,
      'accept': 'image/png'
    },
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    console.log('PNG export retrieved successfully');
    return response.getBlob();
  } else {
    console.error('Failed to get PNG export');
    return null;
  }
}