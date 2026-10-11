const axios = require('axios');

const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com/submissions/batch';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 30;

const getLanguageById = (lang)=>{

    const language = {
        "c++":54,
        "cpp":54,
        "java":62,
        "javascript":63
    }

    if(!lang) return undefined;
    return language[lang.toLowerCase()];
}


const judgeHeaders = () => ({
  'x-rapidapi-key': process.env.JUDGE0_KEY,
  'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
});


const submitBatch = async (submissions)=>{

  const response = await axios.request({
    method: 'POST',
    url: JUDGE0_URL,
    params: { base64_encoded: 'false' },
    headers: { ...judgeHeaders(), 'Content-Type': 'application/json' },
    data: { submissions }
  });

  return response.data;
}


// setTimeout ko Promise me wrap kiya — warna await kuch wait hi nahi karta
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


const submitToken = async(resultToken)=>{

  for(let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++){

    const response = await axios.request({
      method: 'GET',
      url: JUDGE0_URL,
      params: {
        tokens: resultToken.join(","),
        base64_encoded: 'false',
        fields: '*'
      },
      headers: judgeHeaders()
    });

    const submissions = response.data.submissions;

    // status_id 1 = In Queue, 2 = Processing; baaki sab final result hai
    if(submissions.every((r)=>r.status_id>2))
      return submissions;

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Judge0 timed out while evaluating the submission");
}


// Test cases ko Judge0 pe chala ke results laata hai
const runTestCases = async (code, languageId, testCases)=>{

  const submissions = testCases.map((testcase)=>({
    source_code: code,
    language_id: languageId,
    stdin: testcase.input,
    expected_output: testcase.output
  }));

  const submitResult = await submitBatch(submissions);
  const resultToken = submitResult.map((value)=> value.token);

  return submitToken(resultToken);
}


module.exports = {getLanguageById,submitBatch,submitToken,runTestCases};
