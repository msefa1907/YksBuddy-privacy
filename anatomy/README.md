# Corpus Atlas — 3B insan anatomisi

İki sürüm vardır; ikisi de tarayıcıda three.js ile çalışır.

| Sayfa | Ne |
| --- | --- |
| `index.html` | **Gerçekçi atlas.** Gerçek bir insan vücudundan elde edilmiş BodyParts3D verisinden 931 yapı, 2,44 milyon üçgen (~13,6 MB). |
| `prosedurel.html` | İlk sürüm: hiçbir model dosyası kullanmadan 462 yapıyı (~3,8 milyon üçgen) kodla, sayfa açılırken üretir. |

## Açmak

`index.html` model dosyalarını `data/` klasöründen `fetch` ile yüklediği için bir web sunucusu üzerinden açılmalıdır (doğrudan `file://` ile açılırsa tarayıcı dosyaları vermez):

```sh
cd anatomy
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000/
```

three.js CDN'den yüklendiği için internet bağlantısı gerekir.

## Gerçekçi atlasta neler var

| Sistem | İçerik |
| --- | --- |
| İskelet (281) | Kafatası kemikleri, 32 diş, tüm omurlar ve diskler, kaburgalar ve kıkırdakları, el ve ayak kemikleri, bağlar |
| Kaslar (432) | Mimik ve çiğneme kasları, gövde, sırt (derin kaslar dâhil), kol, el, bacak ve ayak kasları; kirişler beyaz görünür |
| Sinir sistemi (99) | Beyin kabuğu kıvrımları, beyincik, beyin sapı, bazal çekirdekler, limbik sistem, beyin karıncıkları, göz ve görme yolu |
| Kalp ve damarlar | Kalp duvarı, kapaklar, papiller kaslar, koroner damarlar; aort ve dalları, ana toplardamarlar, akciğer damarları |
| Organlar | Akciğer lobları, soluk borusu, diyafram; sindirim kanalı, karaciğer, safra kesesi, pankreas, dalak; böbrekler ve idrar yolları; endokrin bezler; erkek üreme organları |
| Deri | Tam vücut deri yüzeyi (yarı saydam veya opak) |

Her yapı tıklanabilir; Türkçe adı, Latince adı ve YKS düzeyinde kısa bir açıklaması gösterilir. Hazır görünümler, katman başına opaklık, arama (Türkçe karakterlere duyarsız), kesit düzlemi (kesilen yapıların içi dolu görünür), yarı kesit, ayrıştırma, etiketler, kalp atışı ve solunum animasyonu bulunur.

Bütün yüzey ayrıntısı (kas lifleri, kemik dokusu, organ ıslaklığı, akciğer dokusu, deri gözenekleri, göz bebeği) doku dosyası olmadan, gölgelendiricide üretilir.

## Veri ve lisans

Gerçekçi atlastaki modeller **BodyParts3D**'den türetilmiştir:

> BodyParts3D, Copyright © 2008 Life Science Integrated Database Center (DBCLS), licensed under [CC Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
> Mitsuhashi N. ve ark., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37 (2009) D782–D785.

`data/` klasöründeki türetilmiş model dosyaları da aynı lisansla (CC BY-SA 2.1 JP) paylaşılır; ayrıntı için `data/LICENSE.txt`.

## Geliştirme

- `viewer/` — gerçekçi atlasın kaynağı (`page.html`, `desc.js` Türkçe açıklamalar, `app.js`).
- `src/` — prosedürel sürümün kaynağı.
- `tools/` — BodyParts3D STL dosyalarından `data/` paketlerini üreten Python betikleri: yapıları sınıflandırıp Türkçe adlandırır (`catalog.py`), ağları sadeleştirir, ortam örtmesini (AO) ve kas/kiriş kalınlığını önceden hesaplar, sıkıştırılmış ikili paketlere yazar (`build_pack.py`). Gerekenler: `numpy`, `pyfqmr`.

```sh
node build.mjs                                   # index.html ve prosedurel.html
python3 tools/build_pack.py <BodyParts3D_data> data   # model paketlerini yeniden üretmek için
```
