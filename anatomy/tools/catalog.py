# Classification and Turkish naming of BodyParts3D structures.
import re

ORD = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8,
       'ninth': 9, 'tenth': 10, 'eleventh': 11, 'twelfth': 12}
FINGER = {'thumb': 'Başparmak', 'index finger': 'İşaret parmağı', 'middle finger': 'Orta parmak', 'ring finger': 'Yüzük parmağı',
          'little finger': 'Serçe parmak', 'big toe': 'Ayak başparmağı', 'second toe': '2. ayak parmağı', 'third toe': '3. ayak parmağı',
          'fourth toe': '4. ayak parmağı', 'little toe': 'Ayak serçe parmağı'}
PHAL = {'proximal': 'proksimal', 'middle': 'orta', 'distal': 'distal'}

# exact base-name translations: base -> (turkish, layer, material)
T = {}
def put(layer, mat, pairs):
    for en, tr in pairs: T[en] = (tr, layer, mat)

put('skeleton', 'bone', [
    ('atlas', 'Atlas (1. boyun omuru)'), ('axis', 'Axis (2. boyun omuru)'), ('body of sternum', 'Göğüs kemiği gövdesi'),
    ('manubrium', 'Göğüs kemiği sapı (manubrium)'), ('xiphoid process', 'Kılıç çıkıntısı'), ('calcaneus', 'Topuk kemiği'),
    ('capitate', 'Başlı kemik'), ('clavicle', 'Köprücük kemiği'), ('cuboid bone', 'Küp kemiği'), ('ethmoid', 'Kalbur kemiği'),
    ('femur', 'Uyluk kemiği'), ('fibula', 'Baldır kemiği'), ('frontal bone', 'Alın kemiği'), ('hamate', 'Çengel kemiği'),
    ('hip bone', 'Kalça kemiği'), ('humerus', 'Pazı kemiği'), ('hyoid bone', 'Dil kemiği'), ('inferior nasal concha', 'Alt burun kavkısı'),
    ('intermediate cuneiform bone', 'Orta çivi kemiği'), ('lacrimal bone', 'Gözyaşı kemiği'), ('lateral cuneiform bone', 'Dış çivi kemiği'),
    ('lunate', 'Ay kemiği'), ('mandible', 'Alt çene kemiği'), ('maxilla', 'Üst çene kemiği'), ('medial cuneiform bone', 'İç çivi kemiği'),
    ('nasal bone', 'Burun kemiği'), ('navicular bone of foot', 'Kayık kemiği (ayak)'), ('occipital bone', 'Art kafa kemiği'),
    ('palatine bone', 'Damak kemiği'), ('parietal bone', 'Yan kafa kemiği'), ('patella', 'Diz kapağı kemiği'), ('pisiform', 'Bezelye kemiği'),
    ('radius', 'Önkol dış kemiği (radius)'), ('sacrum', 'Sağrı kemiği'), ('scaphoid', 'Kayık kemiği (el)'), ('scapula', 'Kürek kemiği'),
    ('sesamoid bone of foot', 'Ayak susam kemiği'), ('sphenoid bone', 'Kama kemiği'), ('talus', 'Aşık kemiği'), ('temporal bone', 'Şakak kemiği'),
    ('tibia', 'Kaval kemiği'), ('trapezium', 'Büyük trapez kemiği'), ('trapezoid', 'Küçük trapez kemiği'), ('triquetral', 'Üçgen kemik'),
    ('ulna', 'Dirsek kemiği (ulna)'), ('vomer', 'Saban kemiği'), ('zygomatic bone', 'Elmacık kemiği'),
])
put('skeleton', 'cartilage', [('costal cartilage', 'Kaburga kıkırdakları'), ('set of nasal cartilages', 'Burun kıkırdakları')])
put('skeleton', 'ligament', [
    ('flexor retinaculum of wrist', 'Bilek bükücü bağı'), ('inguinal ligament', 'Kasık bağı'), ('interosseous membrane of forearm', 'Önkol kemikler arası zarı'),
    ('interosseous membrane of leg', 'Bacak kemikler arası zarı'), ('long plantar ligament', 'Uzun taban bağı'),
])
put('muscle', 'tendon', [
    ('aponeurosis of epicranius', 'Kafa derisi aponörozu (galea)'), ('calcaneal tendon', 'Aşil tendonu'), ('iliotibial tract', 'İliotibial bant'),
    ('linea alba', 'Ak çizgi (linea alba)'), ('intermediate tendon', 'Ara kiriş (digastrik)'), ('tendinous arch of levator ani', 'Levator ani kiriş kemeri'),
])
MUS = [
    ('abdominal part of pectoralis major', 'Büyük göğüs kası (karın bölümü)'), ('abductor digiti minimi of foot', 'Ayak serçe parmağı uzaklaştırıcı kası'),
    ('abductor digiti minimi of hand', 'El serçe parmağı uzaklaştırıcı kası'), ('abductor hallucis', 'Ayak başparmağı uzaklaştırıcı kası'),
    ('abductor pollicis brevis', 'Kısa başparmak uzaklaştırıcı kası'), ('abductor pollicis longus', 'Uzun başparmak uzaklaştırıcı kası'),
    ('acromial part of deltoid', 'Deltoid kas (orta bölüm)'), ('adductor brevis', 'Kısa yaklaştırıcı kas'), ('adductor longus', 'Uzun yaklaştırıcı kas'),
    ('adductor magnus', 'Büyük yaklaştırıcı kas'), ('adductor minimus', 'En küçük yaklaştırıcı kas'), ('anconeus', 'Ankoneus kası'),
    ('anterior belly of digastric', 'İki karınlı kas (ön karın)'), ('ascending part of trapezius', 'Trapez kası (alt bölüm)'), ('brachialis', 'Kol kası'),
    ('brachioradialis', 'Kol-önkol kası'), ('buccinator', 'Yanak kası (buccinator)'), ('cervical rotator', 'Boyun döndürücü kasları'),
    ('clavicular part of deltoid', 'Deltoid kas (ön bölüm)'), ('clavicular part of pectoralis major', 'Büyük göğüs kası (köprücük bölümü)'),
    ('coccygeus', 'Kuyruk sokumu kası'), ('coracobrachialis', 'Korakobrakial kas'), ('corrugator supercilii', 'Kaş çatıcı kas'),
    ('deep head of flexor pollicis brevis', 'Kısa başparmak bükücü kası (derin baş)'), ('deep part of masseter', 'Çiğneme kası (derin bölüm)'),
    ('depressor anguli oris', 'Ağız köşesi indirici kas'), ('depressor labii inferioris', 'Alt dudak indirici kas'), ('depressor septi nasi', 'Burun bölmesi indirici kas'),
    ('descending part of trapezius', 'Trapez kası (üst bölüm)'), ('extensor carpi radialis brevis', 'Kısa radial el bileği açıcı kası'),
    ('extensor carpi radialis longus', 'Uzun radial el bileği açıcı kası'), ('extensor digiti minimi', 'Serçe parmak açıcı kası'),
    ('extensor digitorum', 'Parmak açıcı kas'), ('extensor digitorum brevis', 'Kısa ayak parmağı açıcı kası'), ('extensor digitorum longus', 'Uzun ayak parmağı açıcı kası'),
    ('extensor hallucis brevis', 'Kısa ayak başparmağı açıcı kası'), ('extensor hallucis longus', 'Uzun ayak başparmağı açıcı kası'),
    ('extensor indicis', 'İşaret parmağı açıcı kası'), ('extensor pollicis brevis', 'Kısa başparmak açıcı kası'), ('extensor pollicis longus', 'Uzun başparmak açıcı kası'),
    ('external anal sphincter', 'Dış anal büzgen'), ('external intercostal muscle', 'Dış kaburgalar arası kaslar'), ('external oblique', 'Dış eğik karın kası'),
    ('fibularis brevis', 'Kısa fibular kas'), ('fibularis longus', 'Uzun fibular kas'), ('fibularis tertius', 'Üçüncü fibular kas'),
    ('first lumbrical of foot', 'Ayak 1. lumbrikal kası'), ('second lumbrical of foot', 'Ayak 2. lumbrikal kası'), ('third lumbrical of foot', 'Ayak 3. lumbrikal kası'),
    ('fourth lumbrical of foot', 'Ayak 4. lumbrikal kası'), ('first plantar interosseous of foot', 'Ayak 1. taban kemikler arası kası'),
    ('second plantar interosseous of foot', 'Ayak 2. taban kemikler arası kası'), ('third plantar interosseous of foot', 'Ayak 3. taban kemikler arası kası'),
    ('flexor accessorius', 'Ayak tabanı kare kası'), ('flexor carpi radialis', 'Radial el bileği bükücü kası'), ('flexor digiti minimi brevis of foot', 'Ayak serçe parmağı kısa bükücü kası'),
    ('flexor digiti minimi brevis of hand', 'El serçe parmağı kısa bükücü kası'), ('flexor digitorum brevis', 'Kısa ayak parmağı bükücü kası'),
    ('flexor digitorum longus', 'Uzun ayak parmağı bükücü kası'), ('flexor digitorum profundus', 'Derin parmak bükücü kası'),
    ('flexor hallucis longus', 'Uzun ayak başparmağı bükücü kası'), ('flexor pollicis longus', 'Uzun başparmak bükücü kası'), ('frontalis', 'Alın kası'),
    ('gemellus inferior', 'Alt ikiz kas'), ('gemellus superior', 'Üst ikiz kas'), ('geniohyoid', 'Çene-dil kemiği kası'), ('gluteus maximus', 'Büyük kalça kası'),
    ('gluteus medius', 'Orta kalça kası'), ('gluteus minimus', 'Küçük kalça kası'), ('gracilis', 'İnce kas'),
    ('humeral head of extensor carpi ulnaris', 'Ulnar el bileği açıcı kası (humerus başı)'), ('humeral head of flexor carpi ulnaris', 'Ulnar el bileği bükücü kası (humerus başı)'),
    ('humeral head of pronator teres', 'Yuvarlak pronatör kas (humerus başı)'), ('humeroulnar head of flexor digitorum superficialis', 'Yüzeysel parmak bükücü kası (humeroulnar baş)'),
    ('iliacus', 'İliak kas'), ('iliococcygeus', 'İliokoksigeus kası'), ('iliocostalis cervicis', 'İliokostal kas (boyun)'), ('iliocostalis lumborum', 'İliokostal kas (bel)'),
    ('iliocostalis thoracis', 'İliokostal kas (göğüs)'), ('inferior oblique part of longus colli', 'Uzun boyun kası (alt eğik bölüm)'), ('infraspinatus muscle', 'Diken altı kası'),
    ('innermost intercostal muscle', 'En iç kaburgalar arası kaslar'), ('internal intercostal muscle', 'İç kaburgalar arası kaslar'), ('internal oblique', 'İç eğik karın kası'),
    ('lateral head of flexor hallucis brevis', 'Kısa ayak başparmağı bükücü kası (dış baş)'), ('lateral head of gastrocnemius', 'Baldır kası (dış baş)'),
    ('lateral head of triceps brachii', 'Üç başlı kol kası (dış baş)'), ('latissimus dorsi', 'Geniş sırt kası'), ('levator anguli oris', 'Ağız köşesi kaldırıcı kas'),
    ('levator labii superioris', 'Üst dudak kaldırıcı kas'), ('levator labii superioris alaeque nasi', 'Üst dudak ve burun kanadı kaldırıcı kas'),
    ('levator scapulae', 'Kürek kemiği kaldırıcı kası'), ('long head of biceps brachii', 'Pazı kası (uzun baş)'), ('long head of biceps femoris', 'İki başlı uyluk kası (uzun baş)'),
    ('long head of triceps brachii', 'Üç başlı kol kası (uzun baş)'), ('longissimus capitis', 'Longissimus kası (baş)'), ('longissimus cervicis', 'Longissimus kası (boyun)'),
    ('longissimus thoracis', 'Longissimus kası (göğüs)'), ('longus capitis', 'Uzun baş kası'), ('lower head of lateral pterygoid', 'Dış kanat kası (alt baş)'),
    ('lumbar rotator', 'Bel döndürücü kasları'), ('medial head of flexor hallucis brevis', 'Kısa ayak başparmağı bükücü kası (iç baş)'),
    ('medial head of gastrocnemius', 'Baldır kası (iç baş)'), ('medial head of triceps brachii', 'Üç başlı kol kası (iç baş)'), ('medial pterygoid', 'İç kanat kası'),
    ('mentalis', 'Çene kası'), ('multifidus', 'Multifidus kası'), ('mylohyoid', 'Ağız tabanı kası (milohyoid)'), ('nasalis', 'Burun kası'),
    ('oblique head of adductor hallucis', 'Ayak başparmağı yaklaştırıcı kası (eğik baş)'), ('oblique head of adductor pollicis', 'Başparmak yaklaştırıcı kası (eğik baş)'),
    ('obliquus capitis inferior', 'Alt eğik baş kası'), ('obliquus capitis superior', 'Üst eğik baş kası'), ('obturator externus', 'Dış obturator kas'),
    ('obturator internus', 'İç obturator kas'), ('occipitalis', 'Art kafa kası'), ('omohyoid', 'Kürek-dil kemiği kası'), ('opponens digiti minimi of foot', 'Ayak serçe parmağı karşı getirici kası'),
    ('opponens digiti minimi of hand', 'Serçe parmak karşı getirici kası'), ('opponens pollicis', 'Başparmak karşı getirici kası'), ('orbicularis oris', 'Ağız çevresi halka kası'),
    ('orbital part of orbicularis oculi', 'Göz çevresi halka kası (orbital bölüm)'), ('palmaris longus', 'Uzun avuç içi kası'), ('palpebral part of orbicularis oculi', 'Göz çevresi halka kası (kapak bölümü)'),
    ('pectineus', 'Tarak kası'), ('pectoralis minor', 'Küçük göğüs kası'), ('piriformis', 'Armut biçimli kas'), ('plantaris', 'Taban kası (plantaris)'),
    ('platysma', 'Boyun deri kası (platisma)'), ('popliteus', 'Diz arkası kası'), ('posterior belly of digastric', 'İki karınlı kas (arka karın)'),
    ('pronator quadratus', 'Kare pronatör kas'), ('psoas major', 'Büyük bel kası'), ('pubococcygeus', 'Pubokoksigeus kası'), ('puborectalis', 'Puborektal kas'),
    ('pyramidalis', 'Piramit kası'), ('quadratus femoris', 'Kare uyluk kası'), ('quadratus lumborum', 'Kare bel kası'),
    ('radial head of flexor digitorum superficialis', 'Yüzeysel parmak bükücü kası (radial baş)'), ('rectus abdominis', 'Düz karın kası'),
    ('rectus capitis anterior', 'Ön düz baş kası'), ('rectus capitis lateralis', 'Yan düz baş kası'), ('rectus capitis posterior major', 'Büyük arka düz baş kası'),
    ('rectus capitis posterior minor', 'Küçük arka düz baş kası'), ('rectus femoris', 'Düz uyluk kası'), ('rhomboid major', 'Büyük eşkenar dörtgen kas'),
    ('rhomboid minor', 'Küçük eşkenar dörtgen kas'), ('risorius', 'Gülme kası'), ('sartorius', 'Terzi kası'), ('scalenus anterior', 'Ön merdiven kası'),
    ('scalenus medius', 'Orta merdiven kası'), ('scalenus posterior', 'Arka merdiven kası'), ('semimembranosus', 'Yarı zarlı kas'),
    ('semispinalis capitis', 'Yarı dikenli kas (baş)'), ('semispinalis cervicis', 'Yarı dikenli kas (boyun)'), ('semispinalis thoracis', 'Yarı dikenli kas (göğüs)'),
    ('semitendinosus', 'Yarı kirişli kas'), ('serratus anterior', 'Ön dişli kas'), ('serratus posterior inferior', 'Arka alt dişli kas'),
    ('serratus posterior superior', 'Arka üst dişli kas'), ('set of dorsal interossei of foot', 'Ayak sırtı kemikler arası kasları'),
    ('set of dorsal interossei of hand', 'El sırtı kemikler arası kasları'), ('set of interspinales cervicis', 'Dikenler arası kaslar (boyun)'),
    ('set of interspinales lumborum', 'Dikenler arası kaslar (bel)'), ('set of interspinales thoracis', 'Dikenler arası kaslar (göğüs)'),
    ('set of lateral lumbar intertransversarius muscles', 'Enine çıkıntılar arası kaslar (bel, dış)'), ('set of levatores costarum breves', 'Kısa kaburga kaldırıcı kaslar'),
    ('set of levatores costarum longi', 'Uzun kaburga kaldırıcı kaslar'), ('set of lumbricals of hand', 'El lumbrikal kasları'),
    ('set of medial lumbar intertransversarius muscles', 'Enine çıkıntılar arası kaslar (bel, iç)'), ('set of palmar interossei of hand', 'Avuç kemikler arası kasları'),
    ('set of anterior cervical intertransversarii', 'Enine çıkıntılar arası kaslar (boyun, ön)'), ('set of posterior cervical intertransversarii', 'Enine çıkıntılar arası kaslar (boyun, arka)'),
    ('short head of biceps brachii', 'Pazı kası (kısa baş)'), ('short head of biceps femoris', 'İki başlı uyluk kası (kısa baş)'), ('soleus', 'Dil balığı kası (soleus)'),
    ('spinal part of deltoid', 'Deltoid kas (arka bölüm)'), ('spinalis cervicis', 'Dikensi kas (boyun)'), ('spinalis thoracis', 'Dikensi kas (göğüs)'),
    ('splenius capitis', 'Baş kayış kası'), ('splenius cervicis', 'Boyun kayış kası'), ('sternocleidomastoid', 'Göğüs-köprücük-meme kası'),
    ('sternocostal part of pectoralis major', 'Büyük göğüs kası (göğüs-kaburga bölümü)'), ('sternohyoid', 'Göğüs-dil kemiği kası'), ('sternothyroid', 'Göğüs-tiroit kası'),
    ('stylohyoid', 'Stilohyoid kas'), ('subclavius', 'Köprücük altı kası'), ('subscapularis', 'Kürek altı kası'),
    ('superficial head of flexor pollicis brevis', 'Kısa başparmak bükücü kası (yüzeysel baş)'), ('superficial part of masseter', 'Çiğneme kası (yüzeysel bölüm)'),
    ('superior oblique part of longus colli', 'Uzun boyun kası (üst eğik bölüm)'), ('supinator', 'Supinatör kas'), ('supraspinatus', 'Diken üstü kası'),
    ('temporalis', 'Şakak kası'), ('temporoparietalis', 'Şakak-yan kafa kası'), ('tensor fasciae latae', 'Geniş fasya gerici kas'), ('teres major', 'Büyük yuvarlak kas'),
    ('teres minor', 'Küçük yuvarlak kas'), ('thoracic rotator', 'Göğüs döndürücü kasları'), ('thyrohyoid', 'Tiroit-dil kemiği kası'), ('tibialis anterior', 'Ön kaval kası'),
    ('tibialis posterior', 'Arka kaval kası'), ('transverse head of adductor hallucis', 'Ayak başparmağı yaklaştırıcı kası (enine baş)'),
    ('transverse head of adductor pollicis', 'Başparmak yaklaştırıcı kası (enine baş)'), ('transverse part of trapezius', 'Trapez kası (orta bölüm)'),
    ('transversus abdominis', 'Enine karın kası'), ('transversus thoracis', 'Enine göğüs kası'), ('ulnar head of extensor carpi ulnaris', 'Ulnar el bileği açıcı kası (ulna başı)'),
    ('ulnar head of flexor carpi ulnaris', 'Ulnar el bileği bükücü kası (ulna başı)'), ('ulnar head of pronator teres', 'Yuvarlak pronatör kas (ulna başı)'),
    ('upper head of lateral pterygoid', 'Dış kanat kası (üst baş)'), ('vastus intermedius', 'Ara geniş kas'), ('vastus lateralis', 'Dış geniş kas'),
    ('vastus medialis', 'İç geniş kas'), ('vertical intermediate part of longus colli', 'Uzun boyun kası (dikey bölüm)'), ('zygomaticus major', 'Büyük elmacık kası'),
    ('zygomaticus minor', 'Küçük elmacık kası'), ('procerus', 'Burun kökü kası (procerus)'), ('diaphragm', 'Diyafram'),
]
put('muscle', 'muscle', MUS)
T['diaphragm'] = ('Diyafram', 'respiratory', 'muscle')
put('heart', 'heart', [('wall of heart', 'Kalp duvarı (miyokard)'), ('anterior papillary muscle of ventricle', 'Ön papiller kas'),
    ('papillary muscle of ventricle, nsn', 'Papiller kas'), ('posterior papillary muscle of ventricle', 'Arka papiller kas'), ('septal papillary muscle of ventricle', 'Septal papiller kas')])
put('heart', 'valve', [('mitral valve', 'Mitral kapak (iki yaprakçıklı kapak)'), ('pulmonary valve', 'Akciğer atardamarı kapağı'), ('tricuspid valve', 'Triküspit kapak (üç yaprakçıklı kapak)')])
put('arteries', 'artery', [
    ('anterior interventricular branch of coronary artery, nsn', 'Sol ön inen koroner arter (LAD)'), ('arch of aorta', 'Aort kemeri'), ('ascending aorta', 'Çıkan aort'),
    ('brachiocephalic artery, nsn', 'Kol-baş atardamar gövdesi'), ('celiac artery', 'Çölyak gövde'), ('circumflex branch of coronary artery', 'Sirkumfleks koroner arter'),
    ('common carotid artery', 'Ortak şah atardamarı'), ('common hepatic artery', 'Ortak karaciğer atardamarı'), ('common iliac artery', 'Ortak kalça atardamarı'),
    ('descending aorta', 'İnen aort'), ('external iliac artery', 'Dış kalça atardamarı'), ('gastric artery', 'Mide atardamarı'), ('inferior mesenteric artery', 'Alt mezenterik atardamar'),
    ('internal iliac artery', 'İç kalça atardamarı'), ('marginal branch of coronary artery', 'Kenar koroner dalı'),
    ('posterior interventricular branch of coronary artery, nsn', 'Arka inen koroner arter'), ('posterolateral branch of coronary artery', 'Arka-yan koroner dalı'),
    ('renal artery', 'Böbrek atardamarı'), ('set of interventricular septal branches of coronary artery', 'Septal koroner dalları'), ('splenic artery', 'Dalak atardamarı'),
    ('stem of coronary artery', 'Koroner arter kökü'), ('subclavian artery', 'Köprücük altı atardamarı'), ('superior mesenteric artery', 'Üst mezenterik atardamar'),
    ('trunk of coronary artery', 'Sol ana koroner arter'),
])
T['pulmonary artery'] = ('Akciğer atardamarı', 'arteries', 'pulmArtery')
put('veins', 'vein', [
    ('brachiocephalic vein', 'Kol-baş toplardamarı'), ('common iliac vein', 'Ortak kalça toplardamarı'), ('coronary sinus', 'Koroner sinüs'),
    ('external iliac vein', 'Dış kalça toplardamarı'), ('great cardiac vein', 'Büyük kalp toplardamarı'), ('inferior vena cava', 'Alt ana toplardamar'),
    ('internal iliac vein', 'İç kalça toplardamarı'), ('internal jugular vein', 'İç şah toplardamarı'), ('middle cardiac vein', 'Orta kalp toplardamarı'),
    ('renal vein', 'Böbrek toplardamarı'), ('set of anterior cardiac veins', 'Ön kalp toplardamarları'), ('set of posterior veins of ventricle', 'Karıncık arka toplardamarları'),
    ('splenic vein', 'Dalak toplardamarı'), ('subclavian vein', 'Köprücük altı toplardamarı'), ('superior mesenteric vein', 'Üst mezenterik toplardamar'),
    ('superior vena cava', 'Üst ana toplardamar'),
])
T['pulmonary vein'] = ('Akciğer toplardamarları', 'veins', 'pulmVein')
put('nervous', 'brain', [
    ('accessory short gyrus', 'Ada lobu kısa girusları'), ('angular gyrus', 'Açısal girus'), ('anterior part of superior temporal gyrus', 'Üst şakak girusu (ön)'),
    ('cingulate gyrus', 'Kuşak girusu (singulat)'), ('fusiform gyrus', 'İğsi girus'), ('inferior temporal gyrus', 'Alt şakak girusu'), ('insula', 'Ada lobu (insula)'),
    ('middle frontal gyrus', 'Orta alın girusu'), ('middle temporal gyrus', 'Orta şakak girusu'), ('occipital lobe', 'Art kafa lobu'), ('orbital gyri straight gyrus', 'Orbital ve düz giruslar'),
    ('parahippocampal gyrus', 'Hipokampus çevresi girus'), ('postcentral gyrus', 'Merkez arkası girus (duyu korteksi)'), ('posterior part of superior temporal gyrus', 'Üst şakak girusu (arka, işitme)'),
    ('precentral gyrus', 'Merkez önü girus (motor korteks)'), ('superior frontal gyrus', 'Üst alın girusu'), ('superior parietal lobule precuneus', 'Üst yan kafa lobülü ve prekuneus'),
    ('supramarginal gyrus', 'Kenar üstü girus'),
])
put('nervous', 'whiteMatter', [
    ('white matter structure of cerebral hemisphere', 'Beyin ak maddesi'), ('corpus callosum', 'Nasırlı cisim (corpus callosum)'), ('anterior commissure', 'Ön komissür'),
    ('posterior commissure', 'Arka komissür'), ('commissure of fornix of forebrain', 'Forniks komissürü'), ('fornix of forebrain', 'Forniks'),
    ('anterior limb of internal capsule', 'İç kapsül ön bacağı'), ('brachium of inferior colliculus', 'Alt kollikulus kolu'), ('brachium of superior colliculus', 'Üst kollikulus kolu'),
    ('stria medullaris of thalamus', 'Talamus medüller çizgisi'), ('stria terminalis', 'Terminal çizgi'), ('lamina terminalis', 'Terminal lamina'), ('septum pellucidum', 'Saydam bölme'),
])
put('nervous', 'deepGray', [
    ('amygdala', 'Amigdala'), ('caudate nucleus', 'Kuyruklu çekirdek'), ('globus pallidus', 'Soluk küre (globus pallidus)'), ('habenula', 'Habenula'),
    ('hippocampus', 'Hipokampus'), ('hypothalamus, nsn', 'Hipotalamus'), ('inferior colliculus', 'Alt kollikulus'), ('lateral geniculate body', 'Dış dizimsi cisim'),
    ('mammillary body', 'Memecik cisim'), ('medial geniculate body', 'İç dizimsi cisim'), ('putamen', 'Putamen'), ('superior colliculus', 'Üst kollikulus'),
    ('thalamus', 'Talamus'), ('tuber cinereum', 'Kül rengi kabarıntı'), ('choroid plexus of cerebral hemisphere', 'Koroid pleksus'),
])
put('nervous', 'brainstem', [('cerebellum', 'Beyincik'), ('medulla oblongata', 'Soğancık'), ('midbrain, nsn', 'Orta beyin'), ('peduncle of midbrain', 'Beyin sapı ayakçığı'), ('pons', 'Pons (köprü)'),
    ('interpeduncular fossa', 'Ayakçıklar arası çukur')])
put('nervous', 'csf', [('cerebral aqueduct', 'Beyin su kemeri'), ('fourth ventricle', '4. ventrikül'), ('lateral ventricle', 'Yan ventrikül'), ('third ventricle', '3. ventrikül'),
    ('interventricular foramen', 'Ventriküller arası delik'), ('central canal of spinal cord', 'Omurilik merkez kanalı')])
put('nervous', 'nerve', [('optic chiasm', 'Optik kiazma'), ('optic nerve', 'Görme siniri'), ('optic tract', 'Görme yolu')])
T['eyeball'] = ('Göz küresi', 'nervous', 'eye')
put('respiratory', 'lung', [('lower lobe of lung', 'Akciğer alt lobu'), ('middle lobe of lung', 'Sağ akciğer orta lobu'), ('upper lobe of lung', 'Akciğer üst lobu')])
put('respiratory', 'airway', [('bronchus', 'Bronşlar'), ('trachea', 'Soluk borusu'), ('thyroid cartilage', 'Tiroit kıkırdağı (gırtlak)')])
put('digestive', 'organ', [
    ('appendix', 'Apandis'), ('colon, nsn', 'Kalın bağırsak (kolon)'), ('duodenum', 'Onikiparmak bağırsağı'), ('esophagus', 'Yemek borusu'), ('free taenia', 'Serbest tenya (kolon bandı)'),
    ('gallbladder', 'Safra kesesi'), ('ileum', 'İleum'), ('jejunum', 'Jejunum'), ('liver', 'Karaciğer'), ('mesocolic taenia', 'Mezokolik tenya'), ('omental taenia', 'Omental tenya'),
    ('pancreas, nsn', 'Pankreas'), ('pancreatic duct', 'Pankreas kanalı'), ('rectum', 'Rektum'), ('spleen', 'Dalak'), ('stomach', 'Mide'), ('gingiva of lower jaw', 'Alt diş eti'),
    ('gingiva of upper jaw', 'Üst diş eti'), ('labial part of mouth, nsn', 'Dudaklar'),
])
put('urinary', 'organ', [('kidney', 'Böbrek'), ('ureter', 'Üreter'), ('urethra', 'Üretra'), ('urinary bladder', 'İdrar kesesi')])
put('endocrine', 'organ', [('adrenal gland', 'Böbreküstü bezi'), ('pituitary gland', 'Hipofiz bezi'), ('pineal body', 'Epifiz (pineal bez)'), ('lobe of thymus', 'Timüs lobu')])
put('reproductive', 'organ', [('corpus cavernosum of penis', 'Penis süngerimsi cismi (kavernöz)'), ('corpus spongiosum of penis, nsn', 'Penis süngerimsi cismi (spongioz)'),
    ('deferent duct', 'Sperm kanalı'), ('epididymis', 'Epididimis'), ('glans penis', 'Penis başı'), ('prostate', 'Prostat bezi'), ('seminal vesicle', 'Sperm kesecikleri'), ('testis', 'Testis')])
put('skin', 'skin', [('skin', 'Deri'), ('ear', 'Kulak kepçesi')])
SKIP = {'set of head hairs', 'set of pubic hairs', 'set of eyebrows'}

VERT = {'cervical': ('boyun omuru', 'C'), 'thoracic': ('göğüs omuru', 'T'), 'lumbar': ('bel omuru', 'L')}
TOOTH = {'central secondary incisor': 'orta kesici dişi', 'lateral secondary incisor': 'yan kesici dişi', 'secondary canine': 'köpek dişi',
         'first secondary premolar': '1. küçük azı dişi', 'second secondary premolar': '2. küçük azı dişi', 'first secondary molar': '1. büyük azı dişi',
         'second secondary molar': '2. büyük azı dişi'}

def base_and_side(name):
    side = None
    m = re.match(r'^(left|right) (.*)$', name)
    if m: side, name = m.group(1), m.group(2)
    m = re.match(r'^(.*) of (left|right) (.*)$', name)
    if m: side, name = m.group(2), m.group(1) + ' of ' + m.group(3)
    return name, side

def classify(name):
    """returns (turkish, layer, material) or None to skip"""
    base, side = base_and_side(name)
    if base in SKIP: return None
    sfx = {'left': ' (sol)', 'right': ' (sağ)', None: ''}[side]
    if base in T:
        tr, layer, mat = T[base]
        return tr + sfx, layer, mat, base, side
    m = re.match(r'^(\w+) (cervical|thoracic|lumbar) vertebra$', base)
    if m:
        n = ORD[m.group(1)]; nm, L = VERT[m.group(2)]
        return f'{n}. {nm} ({L}{n})', 'skeleton', 'bone', base, side
    m = re.match(r'^intervertebral disk of (?:(\w+) (cervical|thoracic|lumbar) vertebra|axis)$', base)
    if m:
        if m.group(1) is None: return 'C2–C3 omurlar arası diski', 'skeleton', 'disc', base, side
        n = ORD[m.group(1)]; L = VERT[m.group(2)][1]
        nxt = {'C': ('C', 'T', 7), 'T': ('T', 'L', 12), 'L': ('L', 'S', 5)}[L]
        lab = f'{L}{n}–{nxt[0]}{n + 1}' if n < nxt[2] else f'{L}{n}–{nxt[1]}1'
        return f'{lab} omurlar arası diski', 'skeleton', 'disc', base, side
    m = re.match(r'^(\w+) rib$', base)
    if m: return f'{ORD[m.group(1)]}. kaburga{sfx}', 'skeleton', 'bone', base, side
    m = re.match(r'^(\w+) costal cartilage$', base)
    if m: return f'{ORD[m.group(1)]}. kaburga kıkırdağı{sfx}', 'skeleton', 'cartilage', base, side
    m = re.match(r'^(proximal|middle|distal) phalanx of (.*)$', base)
    if m: return f'{FINGER[m.group(2)]} {PHAL[m.group(1)]} falanksı{sfx}', 'skeleton', 'bone', base, side
    m = re.match(r'^(\w+) metacarpal bone$', base)
    if m: return f'{ORD[m.group(1)]}. el tarak kemiği{sfx}', 'skeleton', 'bone', base, side
    m = re.match(r'^(\w+) metatarsal bone$', base)
    if m: return f'{ORD[m.group(1)]}. ayak tarak kemiği{sfx}', 'skeleton', 'bone', base, side
    m = re.match(r'^(upper|lower) (.*) tooth$', base)
    if m and m.group(2) in TOOTH:
        return f'{"Üst" if m.group(1) == "upper" else "Alt"} {TOOTH[m.group(2)]}{sfx}', 'skeleton', 'tooth', base, side
    return None
