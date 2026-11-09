# Pışpış · iOS'a yükleme adımları

Proje hazır: uygulama, ikon, açılış ekranı, bulutta derleme ve TestFlight'a yükleme hattı, mağaza metinleri ve ekran görüntüleri.
Aşağıdaki adımlar senin hesaplarında giriş ve onay gerektirdiği için senin yapman gerekenler. Her adımda ne gireceğin yazılı.

Toplam süre: yaklaşık 45 dakika.

---

## 1. Firebase (eşinle ortak kayıt için) · 10 dk

1. https://console.firebase.google.com › **Proje ekle** › ad: `pispis` › Google Analytics: kapalı.
2. Sol menü **Derleme › Authentication › Başlayın › Sign-in method** › **Anonim** › Etkinleştir › Kaydet.
3. **Derleme › Firestore Database › Veritabanı oluştur** › konum: `europe-west3 (Frankfurt)` › **Üretim modunda başlat**.
4. Firestore › **Kurallar** sekmesi › içindekileri sil, `firebase/firestore.rules` dosyasının içeriğini yapıştır › **Yayınla**.
5. Sol üst dişli › **Proje ayarları › Genel** › en altta **</>** (Web) simgesi › takma ad: `pispis-ios` › Uygulamayı kaydet.
6. Ekranda çıkan `firebaseConfig` bloğunu `src/firebase-config.js` dosyasına yapıştır (ya da bana gönder, ben yerleştiririm). Bu değerler gizli değildir.

## 2. Apple Developer: paket kimliği · 3 dk

1. https://developer.apple.com/account › **Certificates, Identifiers & Profiles › Identifiers › +**
2. **App IDs › App** › Açıklama: `Pispis` › Bundle ID: **Explicit** › `com.volkansezer.pispis`
3. Ek yetenek seçme, **Register**.
4. Aynı sitede **Membership** (Üyelik) sayfasındaki **Team ID**'yi not al (10 karakter).

## 3. App Store Connect: uygulama kaydı · 5 dk

1. https://appstoreconnect.apple.com › **Uygulamalar › + › Yeni Uygulama**
2. Platform: iOS · Ad: `Pışpış: Bebek Bakım Günlüğü` · Birincil dil: Türkçe · Paket kimliği: `com.volkansezer.pispis` · SKU: `pispis-ios-1` · Kullanıcı erişimi: Tam erişim.

## 4. App Store Connect API anahtarı · 3 dk

1. App Store Connect › **Kullanıcılar ve Erişim › Entegrasyonlar › App Store Connect API › Ekip Anahtarları › +**
2. Ad: `GitHub Pispis` · Erişim: **Yönetici (Admin)**. İmzalama sertifikasının bulutta otomatik oluşturulması için bu rol gerekli.
3. **Oluştur** › `AuthKey_XXXXXXXXXX.p8` dosyasını indir. Sadece bir kez indirilebilir, güvenli bir yerde sakla.
4. Sayfadaki **Issuer ID** ve anahtarın **Key ID** değerlerini not al.

## 5. GitHub: derleme ve yükleme · 10 dk + 15 dk bekleme

1. https://github.com/new › ad: `pispis` › **Private** › Create. (Bana adını söylersen projeyi ben yüklerim.)
2. Projeyi bu depoya yükle.
3. Depo › **Settings › Secrets and variables › Actions › New repository secret** ile şu dördünü ekle:

| Secret adı | Değer |
|---|---|
| `APPLE_TEAM_ID` | Adım 2.4'teki Team ID |
| `APP_STORE_CONNECT_KEY_ID` | Adım 4.4'teki Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Adım 4.4'teki Issuer ID |
| `APP_STORE_CONNECT_KEY_BASE64` | .p8 dosyasının base64 hâli (aşağıda) |

.p8 dosyasını base64'e çevirmek için Windows PowerShell'de, dosyanın bulunduğu klasörde:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```

Bu komut sonucu panoya kopyalar; secret değerine yapıştır.

4. Depo › **Actions › "iOS · TestFlight'e yükle" › Run workflow**. Yaklaşık 15 dakika sürer.
5. Bitince App Store Connect › Pışpış › **TestFlight**'ta derleme görünür (işlenmesi 5-20 dk). **Dahili Test** grubuna kendini ve eşini ekle, iPhone'daki TestFlight uygulamasından kur.

Sonraki her güncellemede sadece **Run workflow**'a basman yeterli; derleme numarası kendiliğinden artar.
Özel (private) depoda GitHub'ın ücretsiz Mac süresi ayda yaklaşık 13 derlemeye yeter.

## 6. Mağazaya gönderme · 15 dk

1. `store/gizlilik.html` sayfasını herkese açık bir adreste yayınla (bana söylersen yayınlarım; paylaşım ayarını herkese açık yapman gerekir).
2. App Store Connect › Pışpış › **1.0 Hazırlanıyor** sayfasına `store/app-store-metinleri.md` dosyasındaki metinleri kopyala.
3. **iPhone 6,9 inç** ekran görüntüsü bölümüne `store/screenshots/` klasöründeki 5 görseli sırayla yükle.
4. **Uygulama Gizliliği** sorularını aynı dosyadaki cevaplara göre doldur.
5. **Derleme** bölümünde TestFlight'taki derlemeyi seç › **İncelemeye Gönder**. Apple incelemesi genellikle 1-3 gün sürer.

---

## Proje yapısı

- `src/app.html` · uygulamanın kendisi (ekranlar, kayıtlar, sesler, ninniler, stok)
- `src/native.js` · iPhone özellikleri: Firebase senkronu, aile kodu, kilitliyken gelen bildirimler, ekranı açık tutma, titreşim
- `src/firebase-config.js` · Firebase ayarları (adım 1.6)
- `firebase/firestore.rules` · veritabanı güvenlik kuralları
- `ios/` · Xcode projesi (Pışpış, com.volkansezer.pispis, iPhone, dikey)
- `assets/` · ikon (SVG ve 1024 px) ve açılış ekranı
- `.github/workflows/ios-testflight.yml` · bulutta derleme ve TestFlight'a yükleme
- `store/` · mağaza metinleri, gizlilik politikası, ekran görüntüleri

Yerelde derlemek için: `npm install`, `npm run build`, `npx cap sync ios`.
