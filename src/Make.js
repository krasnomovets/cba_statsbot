function sendToMakeWebhook(payload) {
  const makeWebhookUrl = PropertiesService.getScriptProperties().getProperty('MAKE_WEBHOOK_URL'); //MAKE WEBHOOK URL is stored in Script Properties
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': payload
  };
  
  console.log('Payload being sent to Make:', payload);
  
  try {
    const response = UrlFetchApp.fetch(makeWebhookUrl, options);
    const responseCode = response.getResponseCode();
    const responseContent = response.getContentText();
    
    console.log('Response code from Make:', responseCode);
    console.log('Response content:', responseContent);
    
    if (responseCode === 200) {
      console.log('Successfully sent data to Make');
      return true;
    } else {
      console.error('Failed to send data to Make. Response code:', responseCode);
      return false;
    }
  } catch (error) {
    console.error('Error sending data to Make:', error);
    return false;
  }
}