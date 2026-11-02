# HR Inventory — ระบบคลังพัสดุและครุภัณฑ์สำนักงาน

ระบบจัดการคลังพัสดุแบบ **ไม่ต้องเขียนโค้ด** แบ่งเป็น 2 ส่วน:

| ส่วน | หน้าที่ | โฮสต์ |
|---|---|---|
| **หน้าเว็บ (static)** | แสดงผลและรับ input ทั้งหมด | GitHub Pages |
| **Google Apps Script** | **รับ–ส่งข้อมูลอย่างเดียว (JSON API)** ไม่มีหน้าเว็บ | script.google.com |

## ลิงก์ใช้งาน
- **แดชบอร์ดจัดการคลัง (ผู้ดูแล):** https://dinoeater-th.github.io/HR-Inventory-/index.html
- **หน้าเบิกของ (เจ้าหน้าที่ · เบิกออกเท่านั้น):** https://dinoeater-th.github.io/HR-Inventory-/withdraw.html
- **URL ของ API (Apps Script):** ดูได้จาก `config.js`

## ความสามารถ
- แดชบอร์ด: จำนวนรายการ/คงเหลือรวม/มูลค่า/ครุภัณฑ์/รายการใกล้หมด + สรุปตามหมวดหมู่
- เพิ่ม แก้ไข ลบ พัสดุและครุภัณฑ์ (มีปุ่มลบพร้อมยืนยัน)
- รับเข้า / เบิกออก พร้อมเลือกหน่วยงาน (งานกลยุทธ์ฯ · งานบริการฯ · งานพัฒนาฯ · งานสวัสดิการฯ)
- รหัสพัสดุอัตโนมัติ 4 หลัก (`0001`–`9999`)
- นำเข้ารายการจาก **ไฟล์ CSV** หรือ **ลิงก์** (Google Sheet / CSV)
- หน้าเบิกของแยกเฉพาะ: **เลือกได้หลายรายการต่อครั้ง**, บันทึกแล้วขึ้น **หน้าต่างใบเบิก**,
  ปุ่มเบิก **ห้ามกดซ้ำ**, สต็อก **ตัดแบบ realtime**, ไม่มีช่องรับเข้า และไม่เห็นข้อมูลฝั่งจัดการคลัง

## โครงสร้างไฟล์
```
Code.gs          โค้ด Apps Script: API (doGet/doPost) + ตรรกะคลังทั้งหมด
appsscript.json  สิทธิ์สคริปต์ (สเปรดชีต + web app)
.clasp.json      scriptId สำหรับ clasp
.claspignore     ไม่ดันไฟล์หน้าเว็บขึ้น Apps Script (API เท่านั้น)
index.html       หน้าแดชบอร์ดผู้ดูแล (static)
withdraw.html    หน้าเบิกของ (static)
config.js        เก็บ URL ของ API — แก้ที่เดียวเมื่อ deploy ใหม่
README.md        ไฟล์นี้
```

## การเรียก API
ทุกฟังก์ชันเรียกผ่าน URL เดียว:

- **อ่านข้อมูล (GET):** `?action=getDashboard` / `getItemList` / `getNextItemCode` / `getNextAssetCode`
- **เขียนข้อมูล (POST):** body เป็น JSON `{ "action":"saveItem", "data":{...} }` (Content-Type: text/plain)
- **สำรองเมื่อ CORS มีปัญหา (GET + JSONP):** `?action=...&callback=myFunc`

action ที่รองรับ: `getDashboard, getItemList, getNextItemCode, getNextAssetCode, saveItem, deleteItem,
saveAsset, deleteAsset, recordTransaction, recordWithdrawalBatch, importItems, importItemsFromUrl,
importItemsFromText, setup`

ตอบกลับเป็น JSON รูปแบบ `{ "ok": true, "result": ... }` หรือ `{ "ok": false, "error": "..." }`

## เมื่อต้องการแก้ไข/ deploy ใหม่
```powershell
clasp push --force                 # ดันโค้ดขึ้น Apps Script
clasp version "คำอธิบาย"
clasp deploy -d "คำอธิบาย"         # ได้ URL ใหม่ → วางลงใน config.js
git add -A ; git commit -m "..." ; git push
```
หน้าเว็บอัปเดตทันทีที่ `git push` (GitHub Pages build เอง)
> หมายเหตุ: เมื่อแก้ `config.js` ให้เพิ่ม `?v=` เลขใหม่ที่แท็ก `<script src="config.js?v=...">`
> ใน `index.html` และ `withdraw.html` ด้วย เพื่อไม่ให้เบราว์เซอร์ใช้ไฟล์เก่าจากแคช

## ข้อมูล
ผูกกับ Google Spreadsheet ID `11voKZ1nFezcgt5Jz2SaBNs4-th7V7xrNKZ2fkz1Fsqo`
(แท็บ `Inventory`, `Transactions`, `Assets`, `Settings` ถูกสร้างอัตโนมัติ)
