const Problem = require("../models/problem");
const Submission = require("../models/submission");
const User = require("../models/user");
const {getLanguageById,runTestCases} = require("../utils/problemUtility");


// Judge0 results ko aggregate karta hai
// status_id: 3 = Accepted, 4 = Wrong Answer, 5 = TLE, 6 = Compilation Error, 7-12 = Runtime Error
const summarizeResults = (testResult)=>{

    let testCasesPassed = 0;
    let runtime = 0;
    let memory = 0;
    let status = 'accepted';
    let errorMessage = null;

    for(const test of testResult){
        if(test.status_id==3){
           testCasesPassed++;
           runtime = runtime+parseFloat(test.time || 0)
           memory = Math.max(memory,test.memory || 0);
        }else{
          // Ek baar 'error' (compile/runtime/TLE) mil gaya to use 'wrong' se overwrite mat karo
          if(status !== 'error')
            status = test.status_id==4 ? 'wrong' : 'error';
          if(!errorMessage)
            errorMessage = test.stderr || test.compile_output || test.status?.description || null;
        }
    }

    return {testCasesPassed, runtime, memory, status, errorMessage};
}


const submitCode = async (req,res)=>{

    try{

       const userId = req.result._id;
       const problemId = req.params.id;

       let {code,language} = req.body;

      if(!userId||!code||!problemId||!language)
        return res.status(400).send("Some field missing");

      if(language==='cpp')
        language='c++'

      const languageId = getLanguageById(language);
      if(!languageId)
        return res.status(400).send("Unsupported language");

    //    Fetch the problem from database
       const problem =  await Problem.findById(problemId);
       if(!problem)
        return res.status(404).send("Problem not found");

    //   Submission pehle 'pending' status ke saath store karo
    const submittedResult = await Submission.create({
          userId,
          problemId,
          code,
          language,
          status:'pending',
          testCasesTotal:problem.hiddenTestCases.length
     })

    //    Judge0 pe hidden test cases chalao
    const testResult = await runTestCases(code, languageId, problem.hiddenTestCases);

    const {testCasesPassed, runtime, memory, status, errorMessage} = summarizeResults(testResult);

    // Store the result in Database in Submission
    submittedResult.status   = status;
    submittedResult.testCasesPassed = testCasesPassed;
    submittedResult.errorMessage = errorMessage;
    submittedResult.runtime = runtime;
    submittedResult.memory = memory;

    await submittedResult.save();

    const accepted = (status == 'accepted')

    // Sirf accepted hone par hi problemSolved me daalo; $addToSet atomic hai (duplicate nahi banega)
    if(accepted){
      await User.updateOne({_id:userId},{$addToSet:{problemSolved:problemId}});
    }

    res.status(201).json({
      accepted,
      status,
      totalTestCases: submittedResult.testCasesTotal,
      passedTestCases: testCasesPassed,
      runtime,
      memory,
      error: errorMessage
    });

    }
    catch(err){
      res.status(500).send("Internal Server Error "+ err.message);
    }
}


const runCode = async(req,res)=>{

     try{
      const userId = req.result._id;
      const problemId = req.params.id;

      let {code,language} = req.body;

     if(!userId||!code||!problemId||!language)
       return res.status(400).send("Some field missing");

      if(language==='cpp')
        language='c++'

      const languageId = getLanguageById(language);
      if(!languageId)
        return res.status(400).send("Unsupported language");

   //    Fetch the problem from database
      const problem =  await Problem.findById(problemId);
      if(!problem)
        return res.status(404).send("Problem not found");

   //    Judge0 pe visible test cases chalao
   const testResult = await runTestCases(code, languageId, problem.visibleTestCases);

   const {testCasesPassed, runtime, memory, status, errorMessage} = summarizeResults(testResult);

   res.status(201).json({
    success: status === 'accepted',
    testCases: testResult,
    passedTestCases: testCasesPassed,
    totalTestCases: testResult.length,
    runtime,
    memory,
    error: errorMessage
   });

   }
   catch(err){
     res.status(500).send("Internal Server Error "+ err.message);
   }
}


module.exports = {submitCode,runCode,summarizeResults};
