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
async function getDayComments(startAt = 0) {
  try {
    const baseUrl = "https://" + domain + ".atlassian.net";

    console.log('running for', startAt);
    const config = {
      method: "post",
      url: baseUrl + `/rest/api/2/search`,
      headers: { "Content-Type": "application/json" , "Authorization": ""},
      auth: auth,
      data: {
        jql: "updatedDate >= startOfDay() AND updatedDate <= endOfDay() ORDER BY updated DESC",
        fields: ["key", "project", "assignee", "status", "comment", "issuetype", "updated", "summary", "parent"],
        maxResults: 10000,
        startAt
      }
    };
    const response = await axios.request(config);
    const result = response.data;
    const issues = response.data.issues;
    console.log('got response: ', Object.keys(response.data), result.maxResults, result.startAt, result.total, issues.length);
    if(result.startAt + issues.length < result.total) {
      const newIssues = await getDayComments(startAt + result.maxResults);
      return issues.concat(newIssues);
    }
    return issues;
  } catch (error) {
    console.error('error: ', error);
    // console.log("error: ");
    // console.log(error.response.data.errors);
  }
}

module.exports = getDayComments;




