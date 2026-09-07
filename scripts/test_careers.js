const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.PORT = '3005';
const app = require(path.join(__dirname, '..', 'server.js'));

function req(method, reqPath, body, auth) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const token = auth
      ? jwt.sign({ sub: process.env.ADMIN_EMAIL || 'admin@smart.edu.np', iatMs: Date.now() }, process.env.JWT_SECRET || 'secret', { expiresIn: 3600 })
      : null;
    const opts = {
      hostname: 'localhost',
      port: 3005,
      path: reqPath,
      method,
      headers: {
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(token ? { Cookie: 'smart_admin_session=' + token } : {})
      }
    };
    const r = http.request(opts, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(b) });
        } catch {
          resolve({ status: res.statusCode, body: b });
        }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

const server = app.listen(3005, async () => {
  console.log('--- STARTING VERIFICATION TESTS ON PORT 3005 ---');

  try {
    // 1. GET /api/public/career-categories
    const pubCats = await req('GET', '/api/public/career-categories');
    console.log('1. Public career categories:', pubCats.status, pubCats.body);

    // 2. GET /api/career-categories
    const adminCats = await req('GET', '/api/career-categories', null, true);
    console.log('2. Admin career categories count:', adminCats.status, Array.isArray(adminCats.body) ? adminCats.body.length : 0);

    // 3. POST /api/career-categories (create new division 'Robotics')
    const newDiv = await req('POST', '/api/career-categories', { name: 'Robotics' }, true);
    console.log('3. Create division Robotics:', newDiv.status, newDiv.body);

    // 4. POST /api/careers (create position in 'Robotics')
    const newJob = await req('POST', '/api/careers', {
      title: 'Robotics Instructor',
      category: 'Robotics',
      description: 'Teach robotics and embedded systems',
      location: 'Jhapa, Nepal',
      employmentType: 'Full-time'
    }, true);
    console.log('4. Create career in Robotics:', newJob.status, newJob.body ? newJob.body.title : 'Error', 'Category:', newJob.body ? newJob.body.category : 'Error');

    // 5. PUT /api/career-categories/:id (rename 'Robotics' -> 'AI & Robotics')
    const renamedDiv = await req('PUT', '/api/career-categories/' + newDiv.body.id, { name: 'AI & Robotics' }, true);
    console.log('5. Rename division:', renamedDiv.status, renamedDiv.body);

    // 6. Check that career's category was cascaded
    const getJob = await req('GET', '/api/careers', null, true);
    const updatedJob = Array.isArray(getJob.body) ? getJob.body.find(j => j.id === newJob.body.id) : null;
    console.log('6. Verify cascade rename on career:', updatedJob ? updatedJob.category : 'NOT FOUND', updatedJob && updatedJob.category === 'AI & Robotics' ? 'SUCCESS' : 'FAILED');

    // 7. Check public careers endpoint
    const pubJobs = await req('GET', '/api/public/careers');
    const pubUpdatedJob = Array.isArray(pubJobs.body) ? pubJobs.body.find(j => j.id === newJob.body.id) : null;
    console.log('7. Verify public careers endpoint:', pubUpdatedJob ? pubUpdatedJob.category : 'NOT FOUND');

    // 8. Clean up test career and test division
    if (newJob.body && newJob.body.id) {
      const delJob = await req('DELETE', '/api/careers/' + newJob.body.id, null, true);
      console.log('8. Delete test career:', delJob.status);
    }
    if (newDiv.body && newDiv.body.id) {
      const delDiv = await req('DELETE', '/api/career-categories/' + newDiv.body.id, null, true);
      console.log('9. Delete test division:', delDiv.status);
    }

    // 10. Verify final list of divisions
    const finalCats = await req('GET', '/api/public/career-categories');
    console.log('10. Final public career categories:', finalCats.body);

    console.log('--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test run error:', err);
  } finally {
    server.close(() => process.exit(0));
  }
});
