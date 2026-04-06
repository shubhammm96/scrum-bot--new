# StandupPro Render Deployment TODO

## Status: [8/12] ⚠️ Render MODULE_NOT_FOUND

### 1. Prepare repo files ✅ Complete
- [✅] Update package.json: Add `engines` field
- [✅] Create Procfile: `web: npm start`
- [✅] Create render.yaml: Render config  
- [✅] Create .env.example: `SESSION_SECRET=...`

### 2. Local verification ✅ Complete
- [✅] `npm install/seed/start` works

### 3. GitHub sync [🚨 CRITICAL]
- [ ] `git add . && git commit -m "Add ALL folders (routes/db/public)" && git push`
- [ ] Verify: https://github.com/shubhammm96/scrum-bot--new/tree/main/routes/

### 4. Render redeploy
- [ ] Trigger manual deploy after GitHub push
- [ ] Env vars set

### 5. Test
- [ ] Login ADM001/admin@kpit

**Next: git push complete project → Render redeploy**
