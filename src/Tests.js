function testInitializeMonthlyTargetData() {
  const testDate = new Date(); // Use current date, or set a specific date for testing
  testDate.setDate(1); // Set to first day of the month for testing
  
  console.log("Testing initializeMonthlyTargetData for date:", testDate);
  initializeMonthlyTargetData(testDate);
  console.log("Check the spreadsheet to verify the data");
}

function testAppendDailyActualData() {
  const testDate = new Date(); // Use current date, or set a specific date for testing
  const testAmount = 50000000; // 50 million UAH, for example
  
  console.log("Testing appendDailyActualData for date:", testDate);
  console.log("Test amount:", testAmount);
  appendDailyActualData(testDate, testAmount);
  console.log("Check the spreadsheet to verify the data");
}

function clearTestData() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) { // Assuming first row is headers
    sheet.deleteRows(2, lastRow - 1);
  }
  console.log("Test data cleared from spreadsheet");
}

// Check Datawrapper flow

// Add this to your Datawrapper.gs file or your Tests.gs file

function testDatawrapperFlow() {
  console.log("Starting Datawrapper flow test...");

  // Step 1: Refresh the chart data
  console.log("Refreshing chart data...");
  const refreshSuccess = refreshDatawrapperChartData();
  if (!refreshSuccess) {
    console.error("Failed to refresh chart data. Stopping test.");
    return;
  }
  console.log("Chart data refreshed successfully.");

  // Wait for the chart to update (you might need to adjust this time)
  console.log("Waiting for chart to update...");
  Utilities.sleep(10000);  // Wait for 10 seconds

  // Step 2: Get the PNG
  console.log("Requesting PNG export...");
  const pngBlob = getDatawrapperPNG();
  if (!pngBlob) {
    console.error("Failed to get PNG export. Stopping test.");
    return;
  }
  console.log("PNG export received successfully.");

  // Step 3: Save PNG to Drive and get URL
  console.log("Saving PNG to Google Drive...");
  const file = DriveApp.createFile(pngBlob.setName("Datawrapper_Chart_" + new Date().toISOString() + ".png"));
  const fileId = file.getId();
  const pngUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  console.log("PNG saved to Drive. URL:", pngUrl);

  // Step 4: Verify the results
  console.log("Test completed successfully.");
  console.log("Please verify the following:");
  console.log("1. Check your Datawrapper chart to ensure the data has been updated.");
  console.log("2. Open this URL to view the exported PNG:", pngUrl);
  console.log("3. Verify that the PNG reflects the latest data from your spreadsheet.");
}