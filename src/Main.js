// Make (Integromat) Webhook URL
const MAKE_WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty('MAKE_WEBHOOK_URL'); //Webhook URL is stored in Script Properties
const MONTHLY_GOAL = 350000000; // 350 million UAH
const TIMEZONE_OFFSET = 3; //TIMEZONE OFFSET

const SPREADSHEET_ID = 'SPREADSHIT_ID'; //Google Spreadsheet ID to save the data to.
const SHEET_NAME = 'SHEET_NAME'; //Google Spreadsheet Sheet name to save the data to.
const ERROR_EMAIL = 'YOUR_EMAIL';
const MONTHLY_GOAL_MLN = 350; // 350 million UAH


function postDailyStats() {
  try {
    resetMilestones();

    const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));
    yesterday.setUTCHours(0, 0, 1); // Set to start of day in UTC
    const dayBeforeYesterday = new Date(new Date(yesterday).setDate(yesterday.getDate() - 1));
    
    // Check if it's the first day of the month
    if (yesterday.getDate() === 1) {
      initializeMonthlyTargetData(yesterday);
    }
    
    console.log("Fetching data for yesterday:", yesterday);
    const yesterdayData = getDonationData(yesterday, true); // Pass true to fetch monthly total
    console.log("Fetching data for day before yesterday:", dayBeforeYesterday);
    const dayBeforeData = getDonationData(dayBeforeYesterday, false); // Pass false to skip monthly total
    
    if (yesterdayData && dayBeforeData) {
      const comparison = compareData(yesterdayData.dailyData, dayBeforeData.dailyData);
      console.log('Monthly total before creating tweet:', yesterdayData.monthlyTotal);
      const tweetText = createTweet(yesterdayData.dailyData, comparison, yesterdayData.monthlyTotal);
      
      console.log('Tweet text to be sent:');
      console.log(tweetText);
      
      console.log("Updating Google Sheet...");
      const sheetUpdated = appendDailyActualData(yesterday, yesterdayData.monthlyTotal);
      
      if (sheetUpdated) {
        console.log("Google Sheet updated successfully. Proceeding to update Datawrapper chart.");
        // Refresh Datawrapper chart and get PNG URL
        console.log("Refreshing Datawrapper chart and getting PNG...");
        const newValue = yesterdayData.monthlyTotal / 1000000; // Convert to millions
        const pngUrl = updateChartAndGetPNG(newValue, yesterday);
        console.log('PNG URL before sending to Make:', pngUrl);

        if (pngUrl) {
          console.log("Successfully obtained chart PNG URL:", pngUrl);
        } else {
          console.warn("Failed to obtain chart PNG URL. Will proceed without image.");
        }
        
        const result = sendDailyUpdateToMake(tweetText, pngUrl);
      if (result) {
        console.log('Data sent to Make successfully!');
      } else {
        console.error('Failed to send data to Make.');
      }

      checkAndCelebrateMilestone(yesterday, yesterdayData.monthlyTotal);
      }
      else {
        console.error("Failed to update Google Sheet. Aborting Datawrapper update.");
        // Consider how you want to handle this scenario (e.g., send an error email, retry, or proceed without the chart)
      }
    } else {
      console.log("Insufficient data to tweet.");
    }
  } catch (error) {
    console.error('Error in postDailyStats:', error);
    sendErrorEmail('postDailyStats', error);
  }
}

function getDonationData(date, fetchMonthly) {
  const dateFrom = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 1));
  const dateTo = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));

  const dateFromStr = Utilities.formatDate(dateFrom, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const dateToStr = Utilities.formatDate(dateTo, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  
  const url = ``; // CBA ENDPOINT URL
  
  console.log('API URL:', url);
  
  try {
    const response = UrlFetchApp.fetch(url);
    const responseCode = response.getResponseCode();
    const responseContent = response.getContentText();
    
    console.log('Response Code:', responseCode);
    console.log('Response Content:', responseContent);

    if (responseCode !== 200) {
      throw new Error(`API returned status code ${responseCode}`);
    }

    const data = JSON.parse(responseContent);
    
    if (!data.totals) {
      throw new Error('No totals data in the response');
    }

    console.log('Total amount (UAH):', data.totals.amount);
    console.log('Total amount (USD):', data.totals.amount_usd);
    console.log('Number of donations:', data.totals.count);
    console.log('Average donation (UAH):', data.totals.avg);
    console.log('Average donation (USD):', data.totals.avg_usd);
    
    let monthlyTotal = null;
    if (fetchMonthly) {
      // Calculate monthly total only if fetchMonthly is true
      monthlyTotal = fetchMonthlyTotal(date);
    }
    
    return {
      dailyData: data.totals,
      monthlyTotal: monthlyTotal
    };
  } catch (error) {
    console.error(`Failed to fetch data: ${error}`);
    console.error('Error details:', error.stack);
    return null;
  }
}

function fetchMonthlyTotal(date) {
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));

  const dateFromStr = Utilities.formatDate(monthStart, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const dateToStr = Utilities.formatDate(monthEnd, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  
  const url = ``; // CBA ENDPOINT URL
  
  console.log(`Fetching monthly total from API: ${url}`);

  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    console.log('Monthly total API response:', JSON.stringify(data));
    const totalAmount = parseFloat(data.totals.amount);
    console.log('Parsed monthly total:', totalAmount);
    return totalAmount;
  } catch (error) {
    console.error(`Failed to fetch monthly total: ${error}`);
    return 0;
  }
}

function compareData(current, previous) {
  const amountDifference = (current.amount - previous.amount) / 1000000; // Difference in millions
  const countDifference = current.count - previous.count;
  
  return {
    amountChange: amountDifference.toFixed(2),
    countChange: countDifference
  };
}


function generateProgressBar(percentage) {
  var filledChar = '▓';
  var emptyChar = '░';
  var totalLength = 15; // Total length of the progress bar
  
  var filledLength = Math.round((percentage / 100) * totalLength);
  var emptyLength = totalLength - filledLength;
  
  return filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength) + ' ' + percentage + '%';
}

function createTweet(data, comparison, monthlyTotal) {
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));
  const formattedDate = Utilities.formatDate(yesterday, 'UTC', "dd.MM");
  const amountInMillions = (parseFloat(data.amount) / 1000000).toFixed(2);

  const amountChangeArrow = parseFloat(comparison.amountChange) >= 0 ? '⬆️' : '⬇️';
  const countChangeArrow = comparison.countChange >= 0 ? '⬆️' : '⬇️';

  const monthlyTotalInMillions = (monthlyTotal / 1000000).toFixed(2);

  let progressBarText = '';
  try {
    console.log(`Creating progress bar. Monthly Total: ${monthlyTotal}, MONTHLY_GOAL: ${MONTHLY_GOAL}`);
    const percentage = ((monthlyTotal / MONTHLY_GOAL) * 100).toFixed(2);
    console.log(`Calculated percentage: ${percentage}%`);
    const progressBar = generateProgressBar(parseFloat(percentage));
    progressBarText = `Цього місяця: ${monthlyTotalInMillions} / ${MONTHLY_GOAL / 1000000} млн грн \n${progressBar}\n\n`;
  } catch (error) {
    console.error('Error generating progress bar:', error);
    console.error('Error stack:', error.stack);
    progressBarText = 'Інформація про прогрес наразі недоступна.\n\n';
  }

  let tweet = `Вчора, ${formattedDate}, ви задонатили .@BackAndAlive ${amountInMillions} млн грн `;
  tweet += `(${amountChangeArrow} на ${Math.abs(comparison.amountChange)} млн), `;
  tweet += `зробивши ${data.count} донатів (${countChangeArrow} на ${Math.abs(comparison.countChange)}). Середній донат: ${parseFloat(data.avg).toFixed(2)} грн.\n\n`;
  tweet += progressBarText;
  tweet += `Підпишись на регулярні донати ПЖ 👇 https://savelife.in.ua/donate/#donate-army-card-weekly?utm_source=twitter&utm_medium=organic&utm_campaign=cbastatsbot`;

  return tweet;
}

function sendDailyUpdateToMake(message, pngUrl) {
  console.log('Received pngUrl in sendDailyUpdateToMake:', pngUrl);
  const payload = JSON.stringify({
    type: 'daily_update',
    projects: [
      {
        project_name: 'Daily Update',
        formatted_tweet: message,
        chart_image_url: pngUrl // Ensure this is not being overwritten
      }
    ]
  });
  console.log('Constructed payload:', payload);
  return sendToMakeWebhook(payload);
}


function initializeMonthlyTargetData(date) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    
    const dailyTarget = MONTHLY_GOAL_MLN / daysInMonth;
    
    let data = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(Date.UTC(year, month, day));
      const formattedDate = Utilities.formatDate(currentDate, 'UTC', 'dd/MM/yyyy');
      const monthYear = Utilities.formatDate(currentDate, 'UTC', 'MM/yyyy');
      const cumulativeTarget = dailyTarget * day;
      
      data.push([formattedDate, monthYear, null, cumulativeTarget.toFixed(2)]);
    }
    
    // Append all the data at once
    sheet.getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
    
    console.log('Monthly target data initialized successfully');
  } catch (error) {
    console.error('Error initializing monthly target data:', error);
    sendErrorEmail('initializeMonthlyTargetData', error);
  }
}

function appendDailyActualData(date, monthlyTotal) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const formattedDate = Utilities.formatDate(date, 'UTC', 'dd/MM/yyyy');
    
    // Find the row for today's date
    const dateColumn = sheet.getRange("A:A").getValues().flat();
    const rowIndex = dateColumn.findIndex(d => d === formattedDate) + 1;
    
    if (rowIndex > 0) {
      // Update the actual donation amount for today's date
      const amountInMillions = monthlyTotal / 1000000; // Convert to millions
      sheet.getRange(rowIndex, 3).setValue(amountInMillions.toFixed(2));
      console.log('Daily actual data updated successfully');
      
      // Verify the update
      return verifySheetUpdate(rowIndex, amountInMillions);
    } else {
      console.error('Could not find matching date row');
      return false;
    }
  } catch (error) {
    console.error('Error appending daily actual data:', error);
    sendErrorEmail('appendDailyActualData', error);
    return false;
  }
}

function verifySheetUpdate(rowIndex, expectedValue) {
  const maxAttempts = 5;
  const waitTime = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Verifying sheet update, attempt ${attempt}`);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const actualValue = sheet.getRange(rowIndex, 3).getValue();
    
    if (Math.abs(actualValue - expectedValue) < 0.01) {
      console.log('Sheet update verified successfully');
      return true;
    }
    
    if (attempt < maxAttempts) {
      console.log('Sheet not yet updated, waiting...');
      Utilities.sleep(waitTime);
    }
  }

  console.error('Failed to verify sheet update after multiple attempts');
  return false;
}

function sendErrorEmail(functionName, error) {
  const subject = `Error in Come Back Alive Fundraising Script: ${functionName}`;
  const body = `An error occurred in the function ${functionName}:\n\n${error.toString()}\n\nStack trace:\n${error.stack}`;
  
  MailApp.sendEmail(ERROR_EMAIL, subject, body);
}


function checkAndCelebrateMilestone(yesterday, monthlyTotal) {
  console.log("Starting milestone check for", yesterday.toDateString());
  
  console.log(`Total donations up to ${yesterday.toDateString()}: ${monthlyTotal} UAH`);
  
  // Calculate the current milestone (rounded down to nearest 50 million)
  const currentMilestone = Math.floor(monthlyTotal / 50000000) * 50000000;
  console.log(`Current milestone: ${currentMilestone} UAH`);
  
  // Get the last celebrated milestone for the month of 'yesterday'
  const lastCelebratedMilestone = getLastCelebratedMilestone(yesterday);
  console.log(`Last celebrated milestone: ${lastCelebratedMilestone} UAH`);
  
  if (currentMilestone > lastCelebratedMilestone) {
    console.log(`New milestone reached: ${currentMilestone} UAH`);
    // We have crossed a new milestone
    celebrateMilestone(currentMilestone, monthlyTotal);
    updateLastCelebratedMilestone(currentMilestone, yesterday);
  } else {
    console.log("No new milestone reached.");
  }
}

function getLastCelebratedMilestone(date) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const scriptProperties = PropertiesService.getScriptProperties();
  const lastMilestone = scriptProperties.getProperty(`lastMilestone_${year}_${month}`);
  return lastMilestone ? parseInt(lastMilestone) : 0;
}

function updateLastCelebratedMilestone(milestone, date) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(`lastMilestone_${year}_${month}`, milestone.toString());
  console.log(`Updated last celebrated milestone to: ${milestone} UAH for ${month+1}/${year}`);
}

function resetMilestones() {
  const today = new Date();
  if (today.getDate() === 2) {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const scriptProperties = PropertiesService.getScriptProperties();
    const key = `lastMilestone_${lastMonth.getFullYear()}_${lastMonth.getMonth()}`;
    scriptProperties.deleteProperty(key);
    console.log(`Reset milestone for ${lastMonth.getMonth() + 1}/${lastMonth.getFullYear()}`);
  }
}

function celebrateMilestone(milestone, totalDonations) {
  const milestoneInMillions = milestone / 1000000;
  const formattedTotalDonations = formatLargeNumber(totalDonations);
  
  let tweet = `Cьогодні ви перетнули позначку у ${milestoneInMillions} млн донатів цього місяця! `;
  tweet += `Наразі на рахунки .@BackAndAlive надійшло ${formattedTotalDonations} гривень. \n\n`;
  tweet += `Як каже пан Тарас: «Багато – не мало». Тож давайте ваші гривні 👇 https://savelife.in.ua/donate?utm_source=twitter&utm_medium=organic&utm_campaign=cbastatsbot \n\n`;
  
  console.log("Milestone celebration tweet to be sent:");
  console.log(tweet);
  
  sendDailyUpdateToMake(tweet);
}

function formatLargeNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}