# ওয়াকফ ও মাদ্রাসার স্বয়ংক্রিয় ব্যাকআপ

এই ব্যবস্থা GitHub Actions থেকে OneDrive-এ **প্রতি তিন দিনে** ব্যাকআপ নেয় এবং **প্রতিটি অ্যাপের সর্বশেষ তিনটি সফল ব্যাকআপ** রাখে। কম্পিউটার চালু থাকার প্রয়োজন নেই।

```text
OneDrive/2-Documents/Database Backups/
├── Waqful Madinah/
│   ├── _objects/                 # encrypted ফাইল; retained snapshots-এর প্রয়োজনমতো রাখা হয়
│   └── backup-তারিখ-সময়-id/      # encrypted database + manifest, complete.json
└── 1-idarah/
    ├── _objects/
    └── backup-তারিখ-সময়-id/
```

Windows-এর Documents known folder বর্তমানে `C:\Users\sanim\OneDrive\2-Documents`। তাই cloud destination-এও `2-Documents` ব্যবহার করা হয়েছে। প্রয়োজন হলে `config.json`-এ পথ পরিবর্তন করতে হবে; আলাদা পথে চালানো একটি নতুন backup history শুরু করবে।

## প্রথমবার চালু করা

1. PowerShell **7**-এ project root থেকে `pwsh -File backup/setup.ps1` চালান। GitHub CLI-তে আগে থেকেই sign-in থাকতে হবে। Script প্রয়োজন হলে official GitHub release থেকে checksum যাচাই করে portable `rclone` ও `age` নেয়; কোনো Windows service স্থাপন করে না।
2. Browser-এ Microsoft sign-in করে OneDrive-এ অনুমতি দিন। Script দুই project folder তৈরি করে। Recovery key `%USERPROFILE%\.config\waqf-backup\recovery-key.txt`-এ restricted ACL দিয়ে থাকবে। এর একটি নিরাপদ **offline কপি** রাখুন: key হারালে encrypted backup খোলা যাবে না। GitHub-এ শুধু public encryption recipient যায়।
3. Script-এর স্থানীয় masked prompt-এ Supabase Session pooler URL (port **5432**, transaction pooler 6543 নয়) ও Storage server key দিন। চ্যাটে কোনো credential পাঠাবেন না। Microsoft refresh token নবায়িত হলে সেটি AES-256-GCM encrypted credential-state artifact হিসেবে রাখা হয়; পরের run repository-bound authenticated state পড়ে। এর key GitHub Secret-এ থাকে। **আলাদা ব্যক্তিগত GitHub token লাগে না।** OneDrive ও server key আগে configured থাকলে শুধু database password দেওয়ার জন্য `pwsh -File backup/setup.ps1 -DatabaseOnly` ব্যবহার করা যায়; linked pooler URL থেকে read-only connection যাচাই করে Secret বসাবে।

স্থানীয় DNS/TLS/network বাধার কারণে password যাচাই করা না গেলে masked input সরাসরি GitHub Secret-এ রেখে cloud runner দিয়ে যাচাই করবে; এটি স্থানীয় login সফল হয়েছে এমন দাবি নয়। Windows system DNS বা TLS verification বদলানো হয় না। স্পষ্ট authentication rejection হলে পুনরায় সঠিক password দিতে হবে।
4. স্থানীয় নতুন files review করে GitHub-এর default branch `main`-এ publish করুন। এই repo-র `CLAUDE.md` অনুযায়ী agent explicit নির্দেশ ছাড়া commit/push করে না।
5. প্রথম run: `gh workflow run database-backup.yml --repo sani1415/10-waqful_madinah -f force=true`। Actions tab-এ **দুই অংশই** সফল হয়েছে নিশ্চিত করুন। GitHub Notifications-এ failed workflow notifications চালু রাখুন।

Secret নাম: `BACKUP_DATABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_AGE_RECIPIENT`, `RCLONE_CONFIG_B64`, `BACKUP_TOKEN_ENCRYPTION_KEY`। Credential নেই এমন workflow সফল বলে দেখাবে না। সাধারণ frontend anon key এই কাজের জন্য যথেষ্ট নয়।

## সময়সূচি ও retention

- GitHub প্রতিদিন বাংলাদেশ সময় **রাত ২:১৭**-এ জাগায়; script OneDrive-এর সর্বশেষ `complete.json` দেখে তিন দিনের schedule interval পূর্ণ না হলে **কোনো database/Storage backup নেয় না**। Daily wake-up = daily backup নয়। মাসের boundary-তে `*/3` cron-এর ভুল ব্যবধান হয় না; দেরিতে upload শেষ হলেও interval চার দিন হয়ে যায় না।
- GitHub schedule দেরি/মিস করতে পারে; মিস হলে পরের wake-up-এ overdue backup হবে। Exact-to-the-second SLA নয়। প্রথম manual run দিয়ে cadence শুরু করা যায়; force run cadence পুনর্নির্ধারণ করে।
- Snapshot → encryption → upload → remote bytes download করে SHA-256 যাচাই → `complete.json` সর্বশেষে publish → সর্বশেষ তিনটির বাইরে পুরোনো **completed** folder সরানো। Verification ব্যর্থ বা marker corrupt হলে rotation বন্ধ হয়। অসম্পূর্ণ upload folder স্বয়ংক্রিয়ভাবে successful বলে গণনা/মোছা হয় না।
- `_objects`-এর কোনো encrypted ফাইল retained তিনটি snapshot-এর যেকোনো একটির প্রয়োজন হলে রাখা হয়। তাই unchanged ফাইল বারবার Supabase থেকে download হয় না। উৎসে file delete হলেও পুরোনো retained snapshot থেকে তা পাওয়া যাবে। এটি একটি shared object store; শুধু snapshot folder নিয়ে restore হবে না, `_objects`-ও লাগবে।
- Plaintext database, ফাইল, PIN, OAuth token বা recovery key GitHub artifacts-এ প্রকাশ করা হয় না। শুধু authenticated encrypted OAuth state artifact-এ থাকে; তা backup নয়। Public repo হলেও workflow logs-এ শুধু status; database ও files সব age-encrypted। GitHub dependency actions commit SHA-তে pinned, npm dependency lockfile আছে।

## কোন ডেটা রাখা হয়

- ওয়াকফ: `public.waqf_*`, `private.waqf_*` tables/sequences; `waqf-files` bucket।
- মাদ্রাসা: `public.mdr_*`, `private.mdr_*` tables/sequences; `mdr-program-receipts`, `dept-expense-receipts`, `mdr-student-documents`, `student-photos`। মাদ্রাসার বিভাগ/হিসাব/খেদমত/shared tables এখন সব `mdr_*`-এর অংশ। `nt_*` notes app-এর rows অন্তর্ভুক্ত নয়। Scope ভবিষ্যতের matching table-ও অন্তর্ভুক্ত করে।
- **Application row data আলাদা**, কিন্তু পুনরুদ্ধারের function/trigger/security dependencies বাদ না দিতে প্রতিটিতে shared `public` ও `private` **schema-only কাঠামো** রাখা হয়। এতে অন্য অ্যাপের table/function সংজ্ঞা থাকতে পারে, অন্য অ্যাপের table rows নয়। এই context blindভাবে existing production-এ restore করবেন না।
- Bucket configuration, object paths/versions/metadata, table row counts এবং checksums encrypted manifest-এ থাকে। Storage policy definitions, extension/version তালিকা এবং এই অ্যাপের realtime publication membership-ও recovery context হিসেবে রাখা হয়। Storage-এর actual bytes আলাদা encrypted objects-এ থাকে। Authentication account data, managed `auth`/`storage`/`vault` schema dump, Edge Function source/secrets বা GitHub credentials এই **application backup**-এর অংশ নয়। এগুলো পূর্ণ Supabase project clone নয়; app source/migrations আলাদা Git repo-তে থাকে। Vault secrets-এর মতো external dependencies নতুন environment-এ আলাদাভাবে configure করতে হবে।
- একই database snapshot থেকে schema/data/inventory পড়া হয়। SQL read-only; production database-এ write/restore/delete চলে না। Storage bytes transactional নয়, তাই download চলার সময় object version পরিবর্তিত হলে নতুন snapshot অসম্পূর্ণ হিসেবে বাদ পড়ে এবং পুরোনো backup রাখা হয়।
- Cross-project foreign key নতুন করে যোগ হলে backup silently omit না করে fail করবে; scope update প্রয়োজন। Download ও encryption tool ব্যর্থ হলেও আগের backup অক্ষত থাকে। নতুন/অচেনা Storage bucket যোগ করলে config-এ অন্তর্ভুক্ত করুন।

## Backup খোলা ও যাচাই করা

OneDrive থেকে পুরো project folder (`backup-*` এবং `_objects`) local disk-এ পাওয়া গেলে:

```powershell
$env:PG_RESTORE_BIN = 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe'
$env:AGE_BIN = "$env:LOCALAPPDATA\WaqfBackupTools\age.exe"
node backup/verify.mjs 'C:\Users\sanim\OneDrive\2-Documents\Database Backups\Waqful Madinah' 'backup-YYYYMMDDTHHMMSSsssZ-id' "$env:USERPROFILE\.config\waqf-backup\recovery-key.txt" 'D:\backup-restore-check'
```

নতুন output folder ব্যবহার করুন। এটি ciphertext ও plaintext checksum, decryption, database archive, COPY table row counts এবং সব actual file যাচাই করে খুলে দেবে। Production স্পর্শ করে না। **এটি checksum/decode verification; নতুন live database-এ পূর্ণ restore drill হয়েছে এমন দাবি নয়।**

বাস্তব recovery করার আগে আলাদা Supabase test project-এ manifest-এর extension তালিকা ও schema context review করে প্রয়োজনীয় structures restore, `data.dump` restore, bucket config create এবং `files/<bucket>/<path>` থেকে Storage API দিয়ে পুনরায় upload করুন। সংশ্লিষ্ট Storage policies ও realtime publication membership manifest থেকে review করে পুনঃস্থাপন করুন। FK cycles থাকলে isolated restore-এ যথাযথ transaction/constraint handling লাগতে পারে। Managed storage tables-এ সরাসরি rows insert না করে Storage API ব্যবহার করুন। Existing shared production-এ blind `--clean`, DROP/TRUNCATE বা overwrite চালাবেন না। প্রথম সফল backup-এর পর এবং schema-তে বড় পরিবর্তনের পর একটি isolated restore drill করা প্রয়োজন।

## যাচাই

`cd backup; npm ci --ignore-scripts; npm test`

Tests: তিন দিনের boundary, late-run handling, scope separation, retained snapshot blob references, malformed marker/path traversal, SQL COPY row counts এবং corruption detection। Credentials ছাড়া live upload বা unattended schedule সচল হয়েছে বলে দাবি করা যাবে না।

References: [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Storage backup limitation](https://supabase.com/docs/guides/platform/backups), [rclone OneDrive](https://rclone.org/onedrive/), [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [age](https://github.com/FiloSottile/age).
