# Equipment and exercise catalogue

Generated from `data/equipment.json` and `data/library.json` by `npm run catalogue`. Don't edit this file by hand.

33 pieces of equipment, 24 exercise families, 129 exercises.

## Equipment

| Item | Kind | Details |
| --- | --- | --- |
| Old barbell (non-rotating sleeves) (`bar-beater`) | bar | 20kg; bar type `standard` |
| Strength Shop Bastard Barbell (`bar-bastard`) | bar | 20kg; bar type `standard` |
| Junior barbell (`bar-junior`) | bar | 10kg; bar type `junior` |
| EZ curl bar (`bar-ez`) | bar | 8kg; bar type `ez` |
| BLK Box safety squat bar (`bar-ssb`) | bar | 32kg; bar type `ssb` |
| Hex trap bar (`bar-trap`) | bar | 25kg; bar type `trap` |
| Mirafit lifting log (`bar-log`) | bar | 30kg; bar type `log` |
| Swiss bar (`bar-swiss`) | bar | 20kg; bar type `swiss`; **to confirm** |
| Bumper plates (`plates-bumper`) | plates | about 140kg in total; **to confirm** |
| Iron plates (`plates-iron`) | plates | about 180kg in total; **to confirm** |
| Mirafit chains (`chains`) | chains | 10kg each; **to confirm** |
| Dumbbells (`dumbbells`) | dumbbells | up to 50kg; missing: 7.5kg, 10kg; **to confirm** |
| Strength Shop Riot cage (`rack`) | rack |  |
| Cage safety arms (`rack-safeties`) | attachment | attaches to Strength Shop Riot cage |
| Monolift arms (Strength Shop) (`rack-monolift`) | attachment | attaches to Strength Shop Riot cage |
| Landmine attachment (`rack-landmine`) | attachment | attaches to Strength Shop Riot cage |
| Mirafit landmine handles (`landmine-handles`) | handle |  |
| Cable and pulley set (hung from the cage or pull-up bar) (`cable-pulleys`) | cable |  |
| Freak Athletes ABX bench (flat, incline, decline) (`abx-bench`) | bench |  |
| ABX leg extension and leg curl (`abx-leg`) | attachment | attaches to Freak Athletes ABX bench (flat, incline, decline) |
| ABX cable attachment (`abx-cable`) | attachment | attaches to Freak Athletes ABX bench (flat, incline, decline) |
| ABX sit-up attachment (`abx-situp`) | attachment | attaches to Freak Athletes ABX bench (flat, incline, decline) |
| ABX strict curl attachment (`abx-curl`) | attachment | attaches to Freak Athletes ABX bench (flat, incline, decline) |
| 45-degree back hyperextension bench (`hyper`) | station |  |
| Primal Strength GHD (low, floor height) (`ghd`) | station |  |
| Dip bars (adjustable height) (`dip-bars`) | station |  |
| Wall-mounted pull-up bar (`pull-up-bar`) | station |  |
| Battle ropes (`battle-ropes`) | conditioning |  |
| Boxing bag (`boxing-bag`) | conditioning |  |
| Resistance bands (various) (`bands`) | accessory |  |
| Strength Shop lifting belt (`lifting-belt`) | accessory |  |
| Dip and pull-up loading belt (`dip-belt`) | accessory |  |
| Rubber gym mats (`mats`) | accessory |  |

## Exercises by family

### Squat

Varies by: Bar type, bar position, depth target (box), pause, heel elevation, hand support.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Back squat (`back-squat`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| Pause back squat (`pause-back-squat`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| Box squat (`box-squat`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| Front squat (`front-squat`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| SSB squat (`ssb-squat`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| SSB squat, heels raised (`ssb-squat-heels-raised`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| SSB box squat (`ssb-box-squat`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| SSB pause squat (`ssb-pause-squat`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| SSB front squat (bar reversed) (`ssb-front-squat`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| Hatfield squat (`hatfield-squat`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| Goblet squat (`goblet-squat`) | kg × reps | Dumbbells |  |
| Goblet squat to box (`goblet-squat-to-box`) | kg × reps | Dumbbells |  |
| Landmine squat (`landmine-squat`) | kg × reps | standard bar, Landmine attachment |  |
| Bodyweight squat (`bodyweight-squat`) | reps | None |  |

### Single-leg squat and lunge

Varies by: Split stance or rear foot raised, load position, hand support.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Split squat (`split-squat`) | kg each × reps, per side | Dumbbells |  |
| Split squat, holding the rack (`rack-supported-split-squat`) | kg × reps, per side | Dumbbells, Strength Shop Riot cage |  |
| Bulgarian split squat (`bulgarian-split-squat`) | kg each × reps, per side | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |
| Step-up (`step-up`) | kg each × reps, per side | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |

### Knee extension

Varies by: Both legs or one, machine or bodyweight.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Leg extension (`leg-extension`) | kg × reps | Freak Athletes ABX bench (flat, incline, decline), ABX leg extension and leg curl |  |
| Single-leg extension (`single-leg-extension`) | kg × reps, per side | Freak Athletes ABX bench (flat, incline, decline), ABX leg extension and leg curl |  |
| Sissy squat, partial range (`sissy-squat-partial`) | reps | None |  |

### Deadlift

Varies by: Bar type, stance, start height (deficit, blocks), handle height on the trap bar.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Deadlift (`deadlift`) | kg × reps | standard bar or junior bar, Bumper plates | spineLoading |
| Sumo deadlift (`sumo-deadlift`) | kg × reps | standard bar or junior bar, Bumper plates | spineLoading |
| Deficit deadlift (`deficit-deadlift`) | kg × reps | standard bar or junior bar, Bumper plates | spineLoading |
| Deadlift from blocks (`block-pull`) | kg × reps | standard bar or junior bar, Bumper plates | spineLoading |
| Trap bar deadlift, high handles (`trap-bar-deadlift-high`) | kg × reps | trap bar, Bumper plates | spineLoading |
| Trap bar deadlift, low handles (`trap-bar-deadlift-low`) | kg × reps | trap bar, Bumper plates | spineLoading |
| Trap bar deficit deadlift (`trap-bar-deficit-deadlift`) | kg × reps | trap bar, Bumper plates | spineLoading |

### Romanian deadlift

Varies by: Barbell or dumbbells, both legs or one, landmine.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Romanian deadlift (`romanian-deadlift`) | kg × reps | standard bar or junior bar | spineLoading |
| DB Romanian deadlift (`db-romanian-deadlift`) | kg each × reps | Dumbbells | spineLoading |
| Single-leg DB Romanian deadlift (`single-leg-db-rdl`) | kg × reps, per side | Dumbbells |  |
| Landmine Romanian deadlift (`landmine-rdl`) | kg × reps | standard bar, Landmine attachment | spineLoading |

### Good morning

Varies by: Barbell or SSB, depth.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Good morning (`good-morning`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms | spineLoading |
| SSB good morning (`ssb-good-morning`) | kg × reps | ssb bar, Strength Shop Riot cage, Cage safety arms | spineLoading |

### Back extension (45-degree bench)

Varies by: Legs (both or one), load (none, plate at chest, plate behind head, dumbbell, barbell, band), emphasis (hip-led flat back or spinal rounding), tempo or pause.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Back extension, bodyweight (`back-extension`) | reps | 45-degree back hyperextension bench |  |
| Back extension, hip-led (flat back) (`back-extension-hip`) | reps | 45-degree back hyperextension bench |  |
| Back extension, spinal (rounding through) (`back-extension-spinal`) | reps | 45-degree back hyperextension bench | spineLoading |
| Back extension, 2-second hold at the top (`back-extension-pause`) | reps | 45-degree back hyperextension bench |  |
| Back extension, plate held at chest (`back-extension-plate-chest`) | kg × reps | 45-degree back hyperextension bench, Iron plates |  |
| Back extension, plate behind head (`back-extension-plate-head`) | kg × reps | 45-degree back hyperextension bench, Iron plates |  |
| Back extension, dumbbell held at chest (`back-extension-db`) | kg × reps | 45-degree back hyperextension bench, Dumbbells |  |
| Back extension, barbell on back (`back-extension-barbell`) | kg × reps | standard bar or junior bar, 45-degree back hyperextension bench | spineLoading |
| Back extension, banded (`back-extension-banded`) | reps | 45-degree back hyperextension bench, Resistance bands (various) |  |
| Back extension, single leg (`back-extension-single-leg`) | reps, per side | 45-degree back hyperextension bench |  |
| Back extension, single leg, plate at chest (`back-extension-single-leg-plate`) | kg × reps, per side | 45-degree back hyperextension bench, Iron plates |  |

### GHD hip and knee work

Varies by: Hip extension, glute-ham raise, Nordic curl.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| GHD hip extension (`ghd-hip-extension`) | reps | Primal Strength GHD (low, floor height) |  |
| Glute-ham raise (`glute-ham-raise`) | reps | Primal Strength GHD (low, floor height) |  |

### Knee flexion (leg curl)

Varies by: Both legs or one, machine or Nordic.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Nordic curl (`nordic-curl`) | reps | Primal Strength GHD (low, floor height) |  |
| Leg curl (`leg-curl`) | kg × reps | Freak Athletes ABX bench (flat, incline, decline), ABX leg extension and leg curl |  |
| Single-leg curl (`single-leg-curl`) | kg × reps, per side | Freak Athletes ABX bench (flat, incline, decline), ABX leg extension and leg curl |  |

### Calf raise

Varies by: Seated or standing, both legs or one.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Seated DB calf raise (`seated-db-calf-raise`) | kg × reps | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |
| Standing calf raise (`standing-calf-raise`) | kg × reps | Dumbbells |  |
| Single-leg standing calf raise (`single-leg-calf-raise`) | kg × reps, per side | Dumbbells |  |

### Horizontal press

Varies by: Barbell or dumbbells, incline, grip width, pause, floor press.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Bench press (`bench-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms, Freak Athletes ABX bench (flat, incline, decline) |  |
| Pause bench press (`pause-bench-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms, Freak Athletes ABX bench (flat, incline, decline) |  |
| Close-grip bench press (`close-grip-bench-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms, Freak Athletes ABX bench (flat, incline, decline) |  |
| Incline bench press (`incline-bench-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage, Cage safety arms, Freak Athletes ABX bench (flat, incline, decline) |  |
| Floor press (`floor-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage |  |
| DB bench press (`db-bench-press`) | kg each × reps | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |
| Incline DB press (`incline-db-press`) | kg each × reps | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |

### Dip and push-up

Varies by: Bodyweight, band-assisted or belt-loaded, push-up elevation.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Push-up (`push-up`) | reps | None |  |
| Push-up, hands raised (`elevated-push-up`) | reps | None |  |
| Dip (`dip`) | reps | Dip bars (adjustable height) |  |
| Weighted dip (`weighted-dip`) | kg × reps | Dip bars (adjustable height), Dip and pull-up loading belt |  |
| Band-assisted dip (`band-assisted-dip`) | reps | Dip bars (adjustable height), Resistance bands (various) |  |

### Vertical press

Varies by: Bar type (barbell, EZ, Swiss, log), seated or standing, strict or push press, landmine.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Overhead press (`overhead-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage | overhead |
| Push press (`push-press`) | kg × reps | standard bar or junior bar, Strength Shop Riot cage | overhead |
| Overhead press (EZ bar) (`overhead-press-ez`) | kg × reps | ez bar | overhead |
| Swiss bar press (`swiss-bar-press`) | kg × reps | swiss bar, Strength Shop Riot cage | overhead |
| Log press from the rack (`log-press`) | kg × reps | log bar, Strength Shop Riot cage | overhead |
| Log clean and press (`log-clean-and-press`) | kg × reps | log bar | overhead, spineLoading |
| Seated DB shoulder press (`seated-db-shoulder-press`) | kg each × reps | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) | overhead |
| Standing DB press (`standing-db-press`) | kg each × reps | Dumbbells | overhead |
| Landmine press (`landmine-press`) | kg × reps | standard bar, Landmine attachment |  |

### Vertical pull

Varies by: Grip (overhand, underhand), assistance (band) or added load (belt), cable pulldown.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Pull-up (`pull-up`) | reps | Wall-mounted pull-up bar |  |
| Chin-up (`chin-up`) | reps | Wall-mounted pull-up bar |  |
| Weighted pull-up (`weighted-pull-up`) | kg × reps | Wall-mounted pull-up bar, Dip and pull-up loading belt |  |
| Band-assisted pull-up (`band-pull-up`) | reps | Wall-mounted pull-up bar, Resistance bands (various) |  |
| Pull-up negative (`negative-pull-up`) | reps | Wall-mounted pull-up bar |  |
| Seated cable pulldown (`cable-pulldown`) | kg × reps | Cable and pulley set (hung from the cage or pull-up bar), Freak Athletes ABX bench (flat, incline, decline) |  |

### Horizontal pull

Varies by: Barbell, dumbbells, cable or landmine, chest-supported or free-standing, one arm or two.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Barbell row (`barbell-row`) | kg × reps | standard bar or junior bar | spineLoading |
| Pendlay row (`pendlay-row`) | kg × reps | standard bar or junior bar, Bumper plates | spineLoading |
| Chest-supported DB row (`chest-supported-db-row`) | kg each × reps | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |
| Single-arm DB row (`single-arm-db-row`) | kg × reps, per side | Dumbbells, Freak Athletes ABX bench (flat, incline, decline) |  |
| Seated cable row (`seated-cable-row`) | kg × reps | Cable and pulley set (hung from the cage or pull-up bar) |  |
| Landmine row (T-bar) (`landmine-row`) | kg × reps | standard bar, Landmine attachment, Mirafit landmine handles | spineLoading |
| Inverted row (`inverted-row`) | reps | Strength Shop Riot cage |  |

### Upper back and rear delts

Varies by: Cable or band face pulls, pull-aparts, rear-delt fly.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Face pull (`face-pull`) | kg × reps | Cable and pulley set (hung from the cage or pull-up bar) |  |
| Band pull-apart (`band-pull-apart`) | reps | Resistance bands (various) |  |
| Rear-delt fly (`rear-delt-fly`) | kg each × reps | Dumbbells |  |

### Lateral raise

Varies by: Dumbbell or cable, Lu raise.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| DB lateral raise (`db-lateral-raise`) | kg each × reps | Dumbbells |  |
| Lu raise (`lu-raise`) | kg each × reps | Dumbbells | overhead |
| Cable lateral raise (`cable-lateral-raise`) | kg × reps, per side | Cable and pulley set (hung from the cage or pull-up bar) |  |

### Biceps

Varies by: Dumbbell, EZ bar, hammer grip, ABX curl attachment, cable.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| DB curl (`db-curl`) | kg each × reps | Dumbbells |  |
| Hammer curl (`hammer-curl`) | kg each × reps | Dumbbells |  |
| EZ bar curl (`ez-bar-curl`) | kg × reps | ez bar |  |
| DB curl on the ABX curl attachment (`abx-db-curl`) | kg × reps | Dumbbells, Freak Athletes ABX bench (flat, incline, decline), ABX strict curl attachment |  |
| Cable curl (`cable-curl`) | kg × reps | Cable and pulley set (hung from the cage or pull-up bar) |  |

### Triceps

Varies by: Cable pushdown, overhead extension, EZ skull crusher.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Cable triceps pushdown (`cable-pushdown`) | kg × reps | Cable and pulley set (hung from the cage or pull-up bar) |  |
| Cable overhead triceps extension (`cable-overhead-extension`) | kg × reps | Cable and pulley set (hung from the cage or pull-up bar) | overhead |
| EZ skull crusher (`ez-skull-crusher`) | kg × reps | ez bar, Freak Athletes ABX bench (flat, incline, decline) |  |
| DB overhead triceps extension (`db-overhead-extension`) | kg × reps | Dumbbells | overhead |

### Anti-movement core

Varies by: Plank, side plank, dead bug, bird dog, Pallof press, McGill curl-up.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Plank (`plank`) | seconds | None |  |
| Side plank (`side-plank`) | seconds, per side | None |  |
| Dead bug (`dead-bug`) | reps, per side | None |  |
| Bird dog (`bird-dog`) | reps, per side | None |  |
| McGill curl-up (`mcgill-curl-up`) | reps | None |  |
| Pallof press (`pallof-press`) | kg × reps, per side | Cable and pulley set (hung from the cage or pull-up bar) |  |
| Band Pallof press (`band-pallof-press`) | reps, per side | Resistance bands (various), Strength Shop Riot cage |  |

### Flexion and hanging core

Varies by: Hanging knee raise, sit-up attachment, GHD sit-up.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Hanging knee raise (`hanging-knee-raise`) | reps | Wall-mounted pull-up bar |  |
| Sit-up on the ABX attachment (`abx-sit-up`) | reps | Freak Athletes ABX bench (flat, incline, decline), ABX sit-up attachment |  |
| GHD sit-up (`ghd-sit-up`) | reps | Primal Strength GHD (low, floor height) |  |

### Carry

Varies by: Farmer's (two hands), suitcase (one hand), trap bar.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Farmer's carry (`farmers-carry`) | metres, kg each | Dumbbells |  |
| Suitcase carry (`suitcase-carry`) | metres, per side | Dumbbells |  |
| Trap bar carry (`trap-bar-carry`) | metres | trap bar, Bumper plates | spineLoading |

### Conditioning

Varies by: Battle ropes, boxing bag, bodyweight circuits, walking and rucking.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Battle ropes, double waves (`battle-ropes`) | seconds | Battle ropes |  |
| Battle ropes, alternating waves (`battle-ropes-alternating`) | seconds | Battle ropes |  |
| Battle ropes, slams (`battle-ropes-slams`) | seconds | Battle ropes |  |
| Boxing bag rounds (`boxing-bag-rounds`) | seconds | Boxing bag | rotation |
| Boxing bag, straight punches only (`boxing-bag-straight-punches`) | seconds | Boxing bag |  |
| Burpee (`burpee`) | reps | None | impact |
| Walk (`walk`) | seconds | None |  |
| Ruck walk (`ruck-walk`) | seconds | None | spineLoading |

### Mobility

Varies by: Hips, hamstrings, upper back and shoulders, deep squat.

| Exercise | Measured by | Equipment | Flags |
| --- | --- | --- | --- |
| Deep squat hold (`deep-squat-hold`) | seconds | None |  |
| Hip mobility flow (`mobility-hips`) | seconds | None |  |
| Hamstring stretch (`mobility-hamstrings`) | seconds, per side | None |  |
| Upper back and shoulder mobility (`mobility-upper-back`) | seconds | None |  |
| Side-lying open book (`open-book`) | reps, per side | None | rotation |
| Seated sciatic nerve slider (`nerve-slider`) | reps, per side | None |  |
