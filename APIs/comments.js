var axios = require("axios");
require("dotenv").config();

const username = process.env.ATLASSIAN_USERNAME;
const password = process.env.ATLASSIAN_API_KEY;
const domain = process.env.DOMAIN;

const auth = {
  username: username,
  password: password,
};
//https://gaiansolutions.atlassian.net/rest/api/2/search

//Gets all issues in a particular project using the Jira Cloud REST API
async function getDayComments() {
  try {
    const baseUrl = "https://" + domain + ".atlassian.net";

    const config = {
      method: "post",
      url: baseUrl + `/rest/api/2/search`,
      headers: { "Content-Type": "application/json" , "Authorization": ""},
      auth: auth,
      data: {
        jql: "project = 'PIR' AND updatedDate >= startOfDay() AND updatedDate <= endOfDay() ORDER BY updated DESC",
        fields: ["key", "project", "assignee", "status", "comment", "issuetype", "updated"]
      }
    };
    const response = await axios.request(config);
    console.log('got response');
    return response.data;
  } catch (error) {
    console.error('error: ', error);
    // console.log("error: ");
    // console.log(error.response.data.errors);
  }
}

module.exports = getDayComments;
