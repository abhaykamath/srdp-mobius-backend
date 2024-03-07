var axios = require("axios");
require("dotenv").config();

const username = process.env.ATLASSIAN_USERNAME;
const password = process.env.ATLASSIAN_API_KEY;
const domain = process.env.DOMAIN;

const auth = {
  username: username,
  password: password,
};

//Gets all issues in a particular project using the Jira Cloud REST API
async function getAlerts() {
  try {
    const baseUrl = "https://" + domain + ".atlassian.net";

    const config = {
      method: "post",
      url: baseUrl + `/rest/api/2/search`,
      headers: { "Content-Type": "application/json" },
      auth: auth,
      data: {
        jql: 'status="Done" AND updatedDate >= startOfDay() AND updatedDate <= endOfDay() ORDER BY updated DESC',
        maxResults: 10000
      },
    };
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log("error: ");
  }
}

module.exports = getAlerts;
