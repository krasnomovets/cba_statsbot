function runProjectUpdateFlow() {
  Logger.log('Entering runProjectUpdateFlow function');
  try {
    // Fetch and parse project data
    var results = fetchAndParseProjects();
    Logger.log('fetchAndParseProjects results: ' + JSON.stringify(results));
    
    // Prepare data for Make
    var tweetData = prepareDataForMake(results);
    Logger.log('prepareDataForMake results: ' + JSON.stringify(tweetData));
    
    if (!tweetData) {
      Logger.log('No project updates to send');
      return;
    }

    // Send data to Make, specifying that this is a project update
    var payload = {
      type: 'project_update',
      projects: tweetData
    };

    Logger.log('Payload to be sent: ' + JSON.stringify(payload));

    var sent = sendToMakeWebhook(JSON.stringify(payload));
    
    if (sent) {
      Logger.log('Project update flow completed successfully.');
    } else {
      Logger.log('Failed to send project updates to Make.');
    }
  } catch (error) {
    Logger.log('Error in project update flow: ' + error.message);
    Logger.log('Error stack: ' + error.stack);
  }
}

function fetchAndParseProjects() {
  console.log("Starting fetchAndParseProjects function");
  var properties = PropertiesService.getScriptProperties();
  var projectsJson = properties.getProperty('PROJECTS');
  var projects;

  if (projectsJson) {
    projects = JSON.parse(projectsJson);
    console.log("Projects loaded from script properties:", projects);
  } else {
    // Default projects if none are stored in properties
    projects = [
      {name: "UZ Casevac", url: "https://savelife.in.ua/uz-casevac/"},
      {name: "Invictus Games 2025", url: "https://savelife.in.ua/invictus-games-2025/"},
      {name: "Nam Tut Zhyty 2", url: "https://savelife.in.ua/nam-tut-zhyty-2/"}
    ];
    console.log("No projects found in properties. Using default projects:", projects);
    
    // Store default projects in properties
    properties.setProperty('PROJECTS', JSON.stringify(projects));
    console.log("Default projects stored in properties.");
  }

  var results = [];
  var updatedProjects = [];
  var completedProjects = [];
  
  for (var i = 0; i < projects.length; i++) {
    var project = projects[i];
    try {
      if (project.name === "Дронопад") {
        console.log("Processing Dronopad project");
        var dronopadData = fetchDronopadData(project.url);
        var previousDataString = properties.getProperty(project.name) || '{"amount":0}';
        var previousData = JSON.parse(previousDataString);
        var previousAmount = parseInt(previousData.amount) || 0;

      // Calculate the amount raised
        var currentAmount = parseInt(dronopadData.amount) || 0;
        var amountRaised = Math.max(currentAmount - previousAmount, 0);

        results.push({
          name: project.name,
          url: project.url,
          amount: currentAmount,
          amountRaised: amountRaised,
          equipmentDelivered: dronopadData.equipmentDelivered,
          wingsDowned: dronopadData.wingsDowned,
          transferredFPV: dronopadData.transferredFPV,
          transferredPickups: dronopadData.transferredPickups,
          ZALA: dronopadData.ZALA,
          Orlan: dronopadData.Orlan,
          Supercam: dronopadData.Supercam,
          totalDronesDowned: dronopadData.totalDronesDowned
        });
        updatedProjects.push(project);
        
        // Save the current amount for next time
        properties.setProperty(project.name, JSON.stringify({
          amount: currentAmount,
          date: new Date().toISOString()
        }));
      } else {
        console.log("Processing standard project:", project.name);
        var data = fetchAndParseProjectData(project.url);
        var previousData = JSON.parse(properties.getProperty(project.name) || '{"amount":0}');
        var amountRaised = data.amount - previousData.amount;
        
        if (data.amount >= data.targetAmount) {
          completedProjects.push({
            name: project.name,
            amount: data.amount,
            targetAmount: data.targetAmount
          });
          properties.deleteProperty(project.name);
        } else {
          updatedProjects.push(project);
          properties.setProperty(project.name, JSON.stringify({
            amount: data.amount,
            date: new Date().toISOString()
          }));
          
          results.push({
            name: project.name,
            url: project.url,
            amount: data.amount,
            targetAmount: data.targetAmount,
            percentage: data.percentage,
            amountRaised: amountRaised,
            progressBar: generateProgressBar(data.percentage)
          });
        }
      }
    } catch (error) {
      console.log('Error processing ' + project.name + ': ' + error.message);
      updatedProjects.push(project);
    }
  }
  
  properties.setProperty('PROJECTS', JSON.stringify(updatedProjects));
  
  logResults(results, completedProjects);
  
  console.log("Completed fetchAndParseProjects function. Results:", JSON.stringify(results));
  return results;  // Make sure to return the results
}

function fetchAndParseProjectData(url) {
  try {
    var response = UrlFetchApp.fetch(url);
    var content = response.getContentText();
    
    console.log("Fetched content length: " + content.length + " characters");
    
    // Updated regex to match the new script tag type
    var scriptRegex = /<script type="[^"]*-text\/javascript">\s*var projectTag[^<]+<\/script>/;
    var scriptMatch = content.match(scriptRegex);
    
    if (scriptMatch) {
      var scriptContent = scriptMatch[0];
      console.log("Found script content: " + scriptContent);
      
      var collectedAmountMatch = scriptContent.match(/collectedAmount\s*=\s*'(\d+)'/);
      var targetAmountMatch = scriptContent.match(/targetAmount\s*=\s*'(\d+)'/);
      
      if (collectedAmountMatch && targetAmountMatch) {
        var collectedAmount = parseInt(collectedAmountMatch[1]);
        var targetAmount = parseInt(targetAmountMatch[1]);
        var percentage = ((collectedAmount / targetAmount) * 100).toFixed(2);
        
        console.log("Parsed data - Collected: " + collectedAmount + ", Target: " + targetAmount + ", Percentage: " + percentage);
        
        return {
          amount: collectedAmount,
          targetAmount: targetAmount,
          percentage: percentage
        };
      } else {
        console.error("Failed to extract amounts from script content");
        console.log("Collected amount match: ", collectedAmountMatch);
        console.log("Target amount match: ", targetAmountMatch);
      }
    } else {
      console.error("Failed to find script content in page");
      console.log("Page content snippet: " + content.substring(0, 500) + "..."); // Log first 500 characters
    }
  } catch (error) {
    console.error("Error in fetchAndParseProjectData: " + error.message);
    console.log("Stack trace: " + error.stack);
  }
  
  throw new Error("Unable to parse project data");
}

function generateProgressBar(percentage) {
  var filledChar = '▓';
  var emptyChar = '░';
  var totalLength = 15; // Total length of the progress bar
  
  var filledLength = Math.round((parseFloat(percentage) / 100) * totalLength);
  var emptyLength = totalLength - filledLength;
  
  return filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength) + ' ' + percentage + '%';
}

function logResults(results, completedProjects) {
  if (completedProjects.length > 0) {
    Logger.log('🎉🎉🎉 COMPLETED PROJECTS 🎉🎉🎉');
    for (var i = 0; i < completedProjects.length; i++) {
      var project = completedProjects[i];
      Logger.log(project.name + ' has reached its goal!');
      Logger.log('Final amount raised: ' + formatNumber(project.amount) + ' UAH');
      Logger.log('Target amount: ' + formatNumber(project.targetAmount) + ' UAH');
      Logger.log('');
    }
    Logger.log('These projects will no longer be included in daily updates.');
    Logger.log('');
  }

  if (results.length > 0) {
    Logger.log('ONGOING PROJECTS');
    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      Logger.log(result.name);
      Logger.log('Amount raised: ' + formatNumber(result.amount) + ' UAH');
      Logger.log('Raised since last update: ' + formatNumber(result.amountRaised) + ' UAH');
      
      if (result.name === "Дронопад") {
        Logger.log('Total drones downed: ' + result.totalDronesDowned);
        Logger.log('Equipment delivered: ' + result.equipmentDelivered);
        Logger.log('Transferred FPV: ' + result.transferredFPV);
      } else {
        Logger.log('Target amount: ' + formatNumber(result.targetAmount) + ' UAH');
        Logger.log('Progress: ' + result.progressBar);
      }
      
      Logger.log('');
    }
  }
}

function formatNumber(num) {
  if (num === undefined || num === null) {
    return 'N/A';
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function addNewProject(name, url) {
  var properties = PropertiesService.getScriptProperties();
  var projectsJson = properties.getProperty('PROJECTS');
  var projects = projectsJson ? JSON.parse(projectsJson) : [];
  
  projects.push({name: name, url: url});
  properties.setProperty('PROJECTS', JSON.stringify(projects));
  
  Logger.log('Added new project: ' + name);
}


function prepareDataForMake(results) {
  Logger.log('Entering prepareDataForMake function');
  Logger.log('results: ' + JSON.stringify(results));
  
  if (!results) {
    Logger.log('Results is null or undefined');
    return null;
  }
  
  if (!Array.isArray(results)) {
    Logger.log('Results is not an array');
    return null;
  }
  
  if (results.length === 0) {
    Logger.log('Results array is empty');
    return null;
  }

  var tweetData = results.map(function(result) {
    if (result.name === "Дронопад") {
      return {
        project_name: result.name,
        project_url: result.url,
        amount_raised: formatNumber(result.amount),
        amount_raised_since_last: formatNumber(result.amountRaised),
        equipment_delivered: result.equipmentDelivered,
        wings_downed: result.wingsDowned,
        transferred_fpv: result.transferredFPV,
        transferred_pickups: result.transferredPickups,
        zala_downed: result.ZALA,
        orlan_downed: result.Orlan,
        supercam_downed: result.Supercam,
        total_drones_downed: result.totalDronesDowned,
        formatted_tweet: createDronopadTweetText(result)
      };
    } else {
      return {
        project_name: result.name,
        project_url: result.url,
        amount_raised: formatNumber(result.amount),
        target_amount: formatNumber(result.targetAmount),
        progress_bar: result.progressBar,
        amount_raised_since_last: formatNumber(result.amountRaised),
        formatted_tweet: createTweetText(result)
      };
    }
  });
  
  Logger.log('Prepared tweet data: ' + JSON.stringify(tweetData));
  return tweetData;
}

// New function to create Dronopad-specific tweet text
function createDronopadTweetText(result) {
  var tweetText = "Dronopad Project Update\n";
  tweetText += "Зібрано: " + formatNumber(result.amount) + " грн\n";
  tweetText += "Збито дронів: " + result.totalDronesDowned + "\n";
  tweetText += "Передано FPV: " + result.transferredFPV + "\n";
  tweetText += "Подробиці 👇 " + result.url;
  return tweetText;
}


function createTweetText(result) {
  var tweetText = result.name + "\n";
  tweetText += "Зібрано: " + formatNumber(result.amount) + " грн з " + formatNumber(result.targetAmount) + " грн\n";
  tweetText += "Прогрес: " + result.progressBar + "\n";
  if (result.amountRaised > 0) {
    tweetText += "Зі вчора ви задонатили " + formatNumber(result.amountRaised) + " грн\n";
  }
  tweetText += "Наблизити мету 👇 " + result.url;
  return tweetText;
}

function sendProjectUpdateToMake(tweetData, isProjectUpdate = false) {
  if (!Array.isArray(tweetData) || tweetData.length === 0) {
    Logger.log('No tweet data to send or invalid data format');
    return false;
  }

  const payload = JSON.stringify({
    type: isProjectUpdate ? 'project_update' : 'daily_update',
    tweets: tweetData
  });

  return sendToMakeWebhook(payload);
}


function addNewProject(name, url) {
  if (!name || !url) {
    console.error('Error: Project name and URL are required.');
    return;
  }

  var properties = PropertiesService.getScriptProperties();
  var projectsJson = properties.getProperty('PROJECTS');
  var projects = projectsJson ? JSON.parse(projectsJson) : [];
  
  // Check if the project already exists
  var projectExists = projects.some(function(project) {
    return project.name === name || project.url === url;
  });

  if (projectExists) {
    console.error('Error: A project with this name or URL already exists.');
    return;
  }

  projects.push({name: name, url: url});
  properties.setProperty('PROJECTS', JSON.stringify(projects));
  
  console.log('Added new project: ' + name + ' (' + url + ')');
  console.log('Updated projects list:', JSON.stringify(projects));
}

// To add a new project to the list type in the values in this function and execute it. 

function addMyNewProject() {
  addNewProject("PROJECT NAME", "PROJECT URL");
}

// Function to view all projects currently stored
function viewAllProjects() {
  var properties = PropertiesService.getScriptProperties();
  var projectsJson = properties.getProperty('PROJECTS');
  var projects = projectsJson ? JSON.parse(projectsJson) : [];
  
  Logger.log('Current projects:');
  projects.forEach(function(project, index) {
    Logger.log(index + ': ' + JSON.stringify(project));
  });
}

// Function to remove a project by its index
function removeProjectByIndex(index) {
  var properties = PropertiesService.getScriptProperties();
  var projectsJson = properties.getProperty('PROJECTS');
  var projects = projectsJson ? JSON.parse(projectsJson) : [];
  
  if (index >= 0 && index < projects.length) {
    var removedProject = projects.splice(index, 1)[0];
    properties.setProperty('PROJECTS', JSON.stringify(projects));
    Logger.log('Removed project: ' + JSON.stringify(removedProject));
  } else {
    Logger.log('Invalid index. No project removed.');
  }
}

//TO REMOVE A PROJECT UPDATE THE INDEX IN THE FOLLOWING FUNCTION AND EXECTUTE IT
function removeThirdProject() {
  removeProjectByIndex(3);  // Removes the third project (index 3)
}

// Function to clear all projects (use with caution!)
function clearAllProjects() {
  var properties = PropertiesService.getScriptProperties();
  properties.deleteProperty('PROJECTS');
  Logger.log('All projects have been cleared from PropertiesService.');
}