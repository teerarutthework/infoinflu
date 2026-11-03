# ฟอลบอร์ด

เว็บจัดอันดับยอดผู้ติดตามดาราและอินฟลูเอนเซอร์ไทย ใช้ของฟรีทั้งหมด

- **กรอกรายชื่อ** ใน Google Sheets
- **GitHub Actions** ดึงยอดอัตโนมัติทุกคืน (YouTube และ Instagram) และเก็บประวัติย้อนหลัง
- **GitHub Pages** โฮสต์หน้าเว็บให้ฟรี

ตอนนี้ในโปรเจกต์มีข้อมูลตัวอย่าง (คนสมมติ 12 คน ย้อนหลัง 60 วัน) ไว้ดูหน้าตาเว็บ เมื่อรันกับรายชื่อจริงครั้งแรก ระบบจะล้างข้อมูลตัวอย่างให้เอง

---

## ไฟล์ในโปรเจกต์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเว็บทั้งหมด |
| `data/people.csv` | รายชื่อ (ใช้เมื่อยังไม่ได้ต่อ Google Sheets) |
| `data/latest.json` | ยอดล่าสุด สคริปต์สร้างให้ ไม่ต้องแก้เอง |
| `data/history.json` | ประวัติรายวัน สคริปต์สร้างให้ ไม่ต้องแก้เอง |
| `scripts/update.mjs` | สคริปต์ดึงยอด |
| `.github/workflows/update.yml` | ตั้งเวลาให้สคริปต์รันทุกวัน 00:43 น. |

---

## ขั้นที่ 1: ขึ้นเว็บ (ประมาณ 10 นาที)

1. สมัคร [GitHub](https://github.com) (ฟรี)
2. กด **New repository** ตั้งชื่อ เช่น `follow-board` เลือก **Public** แล้วกด Create
3. กด **uploading an existing file** แล้วลากไฟล์และโฟลเดอร์ทั้งหมดในโปรเจกต์นี้ขึ้นไป กด Commit
   - โฟลเดอร์ `.github` เป็นโฟลเดอร์ซ่อน ถ้าลากไม่ขึ้น ให้กด **Add file > Create new file** พิมพ์ชื่อ `.github/workflows/update.yml` แล้ววางเนื้อหาจากไฟล์เดิม
4. ไปที่ **Settings > Pages** ตรง Source เลือก **Deploy from a branch** เลือก `main` และ `/ (root)` แล้วกด Save
5. รอ 1–2 นาที เว็บจะอยู่ที่ `https://ชื่อผู้ใช้.github.io/follow-board/`
6. ไปที่ **Settings > Actions > General** ตรง Workflow permissions เลือก **Read and write permissions** แล้วกด Save (ให้ระบบบันทึกยอดใหม่ลง repo ได้)

## ขั้นที่ 2: ใส่รายชื่อผ่าน Google Sheets

1. สร้าง Google Sheet ใหม่ แถวแรกใส่หัวคอลัมน์ตามนี้ (คัดลอกจาก `data/people.csv` ได้เลย)

   ```
   id,name,name_en,category,instagram,tiktok,youtube,x,facebook,instagram_count,tiktok_count,youtube_count,x_count,facebook_count
   ```

   | คอลัมน์ | ใส่อะไร |
   |---|---|
   | `id` | รหัสภาษาอังกฤษ ไม่ซ้ำกัน เช่น `baifern` **ห้ามเปลี่ยนภายหลัง** ไม่งั้นประวัติจะขาด |
   | `name` | ชื่อที่แสดงบนเว็บ |
   | `name_en` | ชื่อภาษาอังกฤษ (ใช้ทำตัวย่อในวงกลม) |
   | `category` | หมวด เช่น นักแสดง, ศิลปิน T-pop, บิวตี้ |
   | `instagram` ถึง `facebook` | ชื่อบัญชีหรือวางลิงก์โปรไฟล์ทั้งลิงก์ก็ได้ ระบบตัดให้เอง |
   | `..._count` | ยอดที่กรอกเอง เช่น `1250000`, `1.25M`, `850K`, `1.2 ล้าน` ช่องที่ดึงอัตโนมัติได้ปล่อยว่างได้ |

2. กด **ไฟล์ > แชร์ > เผยแพร่ไปยังเว็บ** เลือกแผ่นงานที่ใช้ เลือกรูปแบบ **ค่าที่คั่นด้วยจุลภาค (.csv)** แล้วกดเผยแพร่ คัดลอกลิงก์ไว้
   - ลิงก์นี้ใครก็เปิดอ่านได้ ใส่เฉพาะข้อมูลสาธารณะ
3. ใน GitHub ไปที่ **Settings > Secrets and variables > Actions > แท็บ Variables > New repository variable**
   - Name: `SHEET_CSV_URL`
   - Value: ลิงก์ CSV ที่คัดลอกมา
4. ไปที่แท็บ **Actions > อัปเดตยอดฟอล > Run workflow** เพื่อรันทันที ไม่ต้องรอถึงเที่ยงคืน

หลังจากนี้ แก้ชีตเมื่อไหร่ ข้อมูลบนเว็บจะเปลี่ยนตามในรอบถัดไป (หรือกด Run workflow เอง)

## ขั้นที่ 3: ดึงยอด YouTube อัตโนมัติ (ฟรี)

1. เข้า [Google Cloud Console](https://console.cloud.google.com) สร้างโปรเจกต์ใหม่
2. ไปที่ **APIs & Services > Library** ค้นหา **YouTube Data API v3** แล้วกด Enable
3. ไปที่ **APIs & Services > Credentials > Create credentials > API key** คัดลอก key
   - แนะนำให้กด Restrict key แล้วจำกัดให้ใช้ได้แค่ YouTube Data API v3
4. ใน GitHub ไปที่ **Settings > Secrets and variables > Actions > แท็บ Secrets > New repository secret**
   - Name: `YOUTUBE_API_KEY`  Value: key ที่คัดลอกมา

ในคอลัมน์ `youtube` ใส่ handle เช่น `@ชื่อช่อง` หรือรหัสช่องที่ขึ้นต้นด้วย `UC` ก็ได้ แต่ละช่องใช้โควตา 1 หน่วยต่อวัน ซึ่งโควตาฟรีรายวันมีเหลือเฟือ ช่องที่ซ่อนยอดผู้ติดตามจะใช้ตัวเลขที่กรอกเองแทน

## ขั้นที่ 4: ดึงยอด Instagram อัตโนมัติ (ฟรี แต่ตั้งค่ายุ่งกว่า)

ใช้ Business Discovery ของ Meta ดึงได้เฉพาะ**บัญชีปลายทางที่เป็น Business หรือ Creator** (ดาราและอินฟลูฯ ส่วนใหญ่เป็นแบบนี้อยู่แล้ว) บัญชีส่วนตัวดึงไม่ได้ ระบบจะใช้ยอดที่กรอกเองแทน

สิ่งที่ต้องมี:

1. บัญชี Instagram ของคุณเองที่เป็น **Professional (Business หรือ Creator)** ผูกกับ **เพจ Facebook**
2. แอปใน [Meta for Developers](https://developers.facebook.com) ที่เพิ่มผลิตภัณฑ์ Instagram (แบบ Facebook Login)
3. ใช้ **Graph API Explorer** ขอ token ที่มีสิทธิ์ `instagram_basic`, `pages_show_list`, `pages_read_engagement`
4. หา IG User ID ของคุณ: ใน Explorer เรียก `me/accounts?fields=instagram_business_account` ตัวเลขใน `instagram_business_account.id` คือค่าที่ต้องใช้
5. เพิ่ม Secrets ใน GitHub สองตัว
   - `IG_USER_ID` = ตัวเลขจากข้อ 4
   - `IG_ACCESS_TOKEN` = token

เรื่อง token หมดอายุ: token ระยะยาวของผู้ใช้มีอายุราว 60 วัน ต้องสร้างใหม่แล้วอัปเดต Secret ทางที่สะดวกกว่าคือสร้าง **System User** ใน Meta Business Suite แล้วออก token ที่ไม่มีวันหมดอายุ ถ้า token หมดอายุ เว็บจะยังใช้ตัวเลขล่าสุดที่เก็บไว้ ไม่พัง

ลิมิต: ดึงได้ราว 200 ครั้งต่อชั่วโมง ถ้ามีรายชื่อ IG เกิน 180 คน สคริปต์จะเตือนใน log

## TikTok, X, Facebook

ยังไม่มีช่องทางฟรีที่ดึงยอดของบัญชีคนอื่นได้จริง ให้กรอกในคอลัมน์ `tiktok_count`, `x_count`, `facebook_count` แล้วอัปเดตตามรอบที่สะดวก (เช่นทุกวันจันทร์) บนเว็บจะแสดงป้าย "กรอกเอง" กำกับไว้

---

## ข้อมูลบนเว็บมาจากไหน

ทุกแพลตฟอร์มของแต่ละคน ระบบเลือกตัวเลขตามลำดับนี้

1. ดึงอัตโนมัติจาก API (ป้าย "ดึงอัตโนมัติ")
2. ตัวเลขที่กรอกในชีต (ป้าย "กรอกเอง")
3. ตัวเลขล่าสุดที่เคยเก็บไว้ ถ้าวันนั้นดึงไม่ได้ (ป้าย "ตัวเลขล่าสุดที่มี")

## ปรับแต่ง

- **ชื่อเว็บ**: แก้คำว่า `ฟอลบอร์ด` ใน `<title>` และ `<h1>` ของ `index.html`
- **สี**: แก้ค่าใน `:root` ด้านบนของ `index.html` (`--accent` คือสีหลัก)
- **เวลารัน**: แก้บรรทัด `cron` ใน `.github/workflows/update.yml` (เวลาเป็น UTC ซึ่งช้ากว่าไทย 7 ชั่วโมง)
- **โดเมนของตัวเอง**: ซื้อโดเมนแล้วตั้งค่าที่ **Settings > Pages > Custom domain**

## เปิดดูบนเครื่องตัวเอง

ดับเบิลคลิก `index.html` ตรง ๆ จะโหลดข้อมูลไม่ได้ ให้เปิดเทอร์มินัลในโฟลเดอร์โปรเจกต์แล้วรัน

```
python3 -m http.server 8000
```

จากนั้นเปิด `http://localhost:8000`

รันสคริปต์ดึงยอดบนเครื่อง (ต้องมี Node 18 ขึ้นไป):

```
node scripts/update.mjs
```

## ถ้ามีปัญหา

- **Actions ขึ้นสีแดง**: กดเข้าไปดู log จะมีข้อความภาษาไทยบอกสาเหตุ
- **push ไม่ได้ (permission denied)**: กลับไปทำข้อ 6 ของขั้นที่ 1
- **GitHub ปิดการรันอัตโนมัติ**: repo ที่ไม่มีความเคลื่อนไหวนาน GitHub อาจหยุด workflow ให้เข้าแท็บ Actions แล้วกดเปิดใหม่

## ต่อยอดได้อีก

- หน้าโปรไฟล์ของแต่ละคน และลิงก์แชร์เฉพาะคน
- อันดับ "มาแรงประจำสัปดาห์" จัดตามยอดที่เพิ่มขึ้น
- ใส่รูปโปรไฟล์ (ใช้รูปที่ได้รับอนุญาต หรือให้เจ้าตัวส่งมา)
- ปุ่มสลับธีมสว่าง/มืด
