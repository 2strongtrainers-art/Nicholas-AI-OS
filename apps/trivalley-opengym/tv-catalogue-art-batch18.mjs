// Batch 18: reviewed exact-ID generated likeness illustrations, not recorded demonstrations.
const reviewed=(id,name,equipment,bytes,sha256,leftLabel,rightLabel,coaching,url)=>Object.freeze({
  id,name,width:1200,height:800,bytes,sha256,equipment,
  style:'Nick Style 3 + approved primary likeness and avatar',leftLabel,rightLabel,
  coaching:Object.freeze(coaching),steps:Object.freeze([...coaching]),url,
  alt:`AI-generated Nick Kaplan likeness in ${name}. Start: ${leftLabel}. Finish: ${rightLabel}.`,
  review:Object.freeze({
    identity:'approved private right-side gym likeness plus avatar; source photographs excluded from public repository',
    movement:'operator-reviewed against the exact catalogue demonstration; corrected cards replaced before release; independent qualified movement review is unverified'
  })
})

export const CATALOGUE_ART_BATCH18=Object.freeze({
  '2800':reviewed('2800','barbell sitted alternate leg raise (female)','barbell',169380,'6e84d1ba897e36242cd9c106e9d0dcb1fdebe88d88699622fed720209041db12','Sit tall; bar steady overhead','Lift one straight leg',[
    'Sit tall on the floor with both legs extended and hold a deliberately light bar steady overhead.',
    'Brace your trunk and raise one straight leg without letting the bar or your torso drift.',
    'Avoid rounding your back, bending the moving knee or using momentum to lift the leg.',
    'Scale by lowering the bar to the front of your thighs or performing the leg raise without a bar.'
  ],'https://static.wixstatic.com/media/856ae2_8613d710f7f648468db2151f249c4a3e~mv2.webp'),
  '0105':reviewed('0105','barbell standing bradford press','barbell',169256,'69b15f196c3a67aeb60ed0bea927cf196bb14444a9d248595e8e3187b55a2020','Bar at front shoulders','Bar at rear shoulder line',[
    'Stand tall with a very light bar at the front of your shoulders and hands slightly wider than shoulder width.',
    'Press only high enough to guide the bar in a shallow arc to the rear shoulder line, then reverse the path.',
    'Avoid deep lowering behind your head, rib flare or forcing painful shoulder rotation.',
    'Use a dowel or keep the entire movement in front if the behind-head path is not comfortable.'
  ],'https://static.wixstatic.com/media/856ae2_3c2f723a6dd54ef9a5a7b89a1c1272a5~mv2.webp'),
  '2414':reviewed('2414','barbell standing concentration curl','barbell',160640,'5f6381dc6a622512470c543e3a5b8b3d795aa50f8a21aeb10ec79ac01e06b9ac','Hinge; bar hangs low','Curl toward lower chest',[
    'Take a shoulder-width underhand grip on a full barbell and hinge deeply at your hips with the bar hanging below your shoulders.',
    'Keep the hinge fixed and curl the bar with both arms toward your lower chest or upper abdomen.',
    'Avoid standing up during the curl, swinging the bar or allowing your lower back to round.',
    'Use a light bar and a shallower supported hinge if you cannot hold the torso position comfortably.'
  ],'https://static.wixstatic.com/media/856ae2_4a9bc910d8544a4db3f1e3da20051cc8~mv2.webp'),
  '3019':reviewed('3019','bench pull-ups','body weight',148506,'ed42838f020ae3591bf9eb676fef985caa1f3c2351771bc852ba7dd9b153572f','One foot on bench','Pull chest upward',[
    'Hold the pull-up bar securely and place one foot on a stable bench for controlled assistance.',
    'Pull your chest upward while using only as much pressure from the bench foot as needed.',
    'Avoid kicking, pushing from an unstable bench or reaching your chin forward to finish the repetition.',
    'Increase assistance with both feet supported or decrease it by using less pressure through the foot.'
  ],'https://static.wixstatic.com/media/856ae2_941adccff6d9455fa624f0d46529559c~mv2.webp'),
  '1770':reviewed('1770','biceps leg concentration curl','body weight',172628,'344e0ec85881ac4667e33a1e29846673e00a824698883b4c143782038c8e57a5','Brace arm against inner thigh','Curl against leg resistance',[
    'Sit securely, brace the working upper arm against the inside of your thigh and use the opposite leg for resistance.',
    'Curl your forearm upward while the leg supplies smooth opposing pressure through the full controlled range.',
    'Avoid jerking the arm, twisting the wrist or pressing so hard that the elbow or knee becomes uncomfortable.',
    'Reduce the leg pressure and range of motion until you can keep the shoulder and upper arm still.'
  ],'https://static.wixstatic.com/media/856ae2_63a42c01661743a59bc5a20dd35b59a3~mv2.webp'),
  '0137':reviewed('0137','body-up','body weight',129250,'51ad6880bd4f108b8c869e2a7fc316b717aa8b473333977eb110aed7f580a542','Forearms on floor','Press onto palms',[
    'Start in a braced forearm plank with elbows below your shoulders and your body in one straight line.',
    'Place one palm and then the other under your shoulders to press into a high plank, then return with control.',
    'Avoid rocking your hips, sagging through your lower back or letting your hands travel far ahead of your shoulders.',
    'Perform the movement from your knees or alternate the leading arm to reduce fatigue and side bias.'
  ],'https://static.wixstatic.com/media/856ae2_71ccc5bd88cb456397ac6fb008e0aaec~mv2.webp'),
  '1769':reviewed('1769','bodyweight side lying biceps curl','body weight',162406,'77e54258048757dfc8fea0846b0e91c91c318c4a1bedd7f158d705dd014362c9','Side-lying arm and leg setup','Curl against bodyweight',[
    'Lie on your side and secure the working hand against the same-side thigh or lower leg to create bodyweight resistance.',
    'Curl the arm while allowing the supported leg or torso to provide smooth resistance without losing the side-lying position.',
    'Avoid pulling on the knee joint, twisting your neck or using a sudden yank to start the repetition.',
    'Use lighter self-resistance and a shorter curl range until the setup feels stable and controlled.'
  ],'https://static.wixstatic.com/media/856ae2_83e512dfa5d04935ae54b620cd22cbf1~mv2.webp'),
  '3168':reviewed('3168','bodyweight squatting row','body weight',163992,'7e3f71684a1eb391c9a810f17828a4a180adf293a5b66e2f7c174781550d586b','Hold squat; arms long','Row chest toward bars',[
    'Hold a secure fixed bar with both hands, sit into a supported squat and keep your heels planted.',
    'Maintain the squat as you pull your chest toward the bars by driving your elbows behind you.',
    'Avoid letting your knees collapse inward, shrugging your shoulders or standing up to complete the row.',
    'Use a higher hand position and a shallower squat to reduce the load on your legs and upper body.'
  ],'https://static.wixstatic.com/media/856ae2_68f37eef659a490291433a48a55e91d5~mv2.webp'),
  '3167':reviewed('3167','bodyweight squatting row with towel','body weight',143628,'32292870e55bb03661c326595185b9a2cb797adc924d0c97aee3ac7e4a6c2f78','Hold towel; sit into squat','Row while squat stays fixed',[
    'Loop a strong towel around a secure fixed support, grip both ends and sit back into a balanced squat.',
    'Keep the squat depth steady while pulling your chest toward your hands and squeezing your shoulder blades.',
    'Avoid using a loose anchor, sliding your feet or standing up as the elbows bend.',
    'Shorten the lean and squat depth, and inspect the towel and anchor before every set.'
  ],'https://static.wixstatic.com/media/856ae2_907146e5191e4e4a9c89acb0e73e481b~mv2.webp'),
  '3156':reviewed('3156','bodyweight standing one arm row','body weight',151694,'c306f10cfd779126b70423cccfc6de60b650ae2b490538c140728cebe7c2ab2a','One arm long; body leaned','Row chest toward support',[
    'Grip a secure fixed support with one hand, lean back as one unit and keep both feet firmly planted.',
    'Pull your chest toward the support with the working elbow while keeping your hips and shoulders square.',
    'Avoid twisting toward the anchor, shrugging the shoulder or letting your hips sag behind your torso.',
    'Stand more upright to reduce resistance and train both sides with the same controlled range.'
  ],'https://static.wixstatic.com/media/856ae2_27a703423f474854b423c6db5e44dc28~mv2.webp'),
  '3158':reviewed('3158','bodyweight standing close-grip row','body weight',149016,'42c963f8a540684a0e42c4400d4cf5e502d4aedb2e701e6c77618d1d5d785783','Close grip; body leaned','Pull chest to hands',[
    'Take a secure close two-hand grip on the fixed support and lean back with your body braced in one line.',
    'Pull your chest toward your hands while keeping your elbows close and shoulders down from your ears.',
    'Avoid bending at the hips, craning your neck or bouncing out of the bottom position.',
    'Stand closer to upright for less resistance and step farther out only after the setup is stable.'
  ],'https://static.wixstatic.com/media/856ae2_0df07a511c8949a9bd6cfb0ed3e922dd~mv2.webp'),
  '3162':reviewed('3162','bodyweight standing one arm row (overhand grip)','body weight',145804,'9d216d919c2278a0de9638d1e2acf02b9e70a1313cb337febd8e6e2efffcc72e','One overhand grip; lean back','Row without rotating',[
    'Use one overhand grip on a secure fixed support and lean back with your ribs, hips and legs aligned.',
    'Drive the working elbow back to pull your torso toward the support while keeping your chest square.',
    'Avoid rotating your trunk, hiking the shoulder or losing your foot position during the pull.',
    'Reduce the body angle for an easier repetition and match the setup and repetitions on both sides.'
  ],'https://static.wixstatic.com/media/856ae2_c57841bb1ebf4d59b84ac41845b7ed3d~mv2.webp'),
  '3161':reviewed('3161','bodyweight standing one arm row with towel','body weight',142692,'ad9a228dddd05ca6ec1122033081db097b1f2e592be50420448b749153dd3606','One-hand towel hold','Row body toward anchor',[
    'Secure a strong towel around a fixed support, grip one end with one hand and lean back under control.',
    'Pull your body toward the anchor with the working arm while keeping your trunk square and rigid.',
    'Avoid using a damaged towel, rotating through your torso or letting the shoulder roll forward.',
    'Stand more upright and use a shorter lean; inspect the towel and anchor before each set.'
  ],'https://static.wixstatic.com/media/856ae2_945de5be4b62449180728ed194a64004~mv2.webp'),
  '3166':reviewed('3166','bodyweight standing row','body weight',138644,'4b4bc055acf8a10395ecc451a7ffda43b1eb684eaf5b3674613aa4f8cef836f2','Arms long; body leaned','Pull chest toward support',[
    'Hold a secure fixed support with both hands and lean back with your body straight from shoulders to ankles.',
    'Pull your chest toward the support and squeeze your shoulder blades while keeping your feet planted.',
    'Avoid shrugging, bending at the hips or using momentum to bounce through the repetition.',
    'Stand more upright to reduce resistance and increase the lean only after you can control both directions.'
  ],'https://static.wixstatic.com/media/856ae2_0264f55df0844791a2ac730e3e6c5622~mv2.webp'),
  '3165':reviewed('3165','bodyweight standing row with towel','body weight',149696,'0afcfdd29b1cde65def228c2535a09dc33da4c8da866799c5bd1bfa81db9ba23','Towel secure; arms long','Row chest toward hands',[
    'Loop a strong towel around a secure post, grip both ends and lean back with your body in one line.',
    'Bend your elbows and pull your chest toward your hands while keeping your shoulders down and back.',
    'Avoid a loose anchor, worn towel, bent hips or jerking your body to finish the row.',
    'Use a more upright body angle and inspect both the towel and anchor before every set.'
  ],'https://static.wixstatic.com/media/856ae2_7ef652b203fc4421822487cce79ae9cf~mv2.webp'),
  '1265':reviewed('1265','cable one arm incline press','cable',135536,'31f5f21e8e6ea4e15364c2e1b81f6f1743e8013146f4060ecbce8d340266c12f','Handle by upper chest','Press up and forward',[
    'Set an incline bench in front of a low cable and hold one handle beside your upper chest with feet planted.',
    'Press the handle up and forward over your upper chest while keeping your shoulder supported by the bench.',
    'Avoid twisting your torso, shrugging the working shoulder or letting the cable pull your wrist backward.',
    'Use a light load, a modest incline and train both arms through the same comfortable range.'
  ],'https://static.wixstatic.com/media/856ae2_ac4f09d319804af5b3cc371aed3af85a~mv2.webp'),
  '1266':reviewed('1266','cable one arm incline press on exercise ball','cable',134798,'8b65878e76e39fde7328ade6b65ff7d91386ac0091f54ac1db9987ff366fee12','Incline torso; handle at chest','Press above upper chest',[
    'Support your upper back and head on a stable ball, lower your hips for an incline and plant your feet wide.',
    'Press one low-cable handle above your upper chest while keeping your hips, trunk and ball steady.',
    'Avoid rolling the ball, twisting your ribs or letting your head hang unsupported.',
    'Use a light load or replace the ball with a stable incline bench when balance is limited.'
  ],'https://static.wixstatic.com/media/856ae2_5a35ead0e6584131bb62dbc930d6c0ff~mv2.webp'),
  '0191':reviewed('0191','cable one arm lateral bent-over','cable',148578,'444f43977052fbcbc0981ccfb865d4f77115a9a52c303c6cd6b2ab8147951a22','Hinge; arm crosses low','Raise arm out to side',[
    'Stand side-on to a low cable, hinge with a neutral back and hold the handle across the front of your body.',
    'Raise the working arm out to the side with a soft elbow until it reaches a comfortable shoulder height.',
    'Avoid standing up, rotating your trunk or shrugging the shoulder to move the cable.',
    'Use a very light load and support the free hand on a stable surface if needed.'
  ],'https://static.wixstatic.com/media/856ae2_652105b45d414ddbb77184ce8f1d3fb5~mv2.webp'),
  '0192':reviewed('0192','cable one arm lateral raise','cable',170686,'c1ad161b576d599f5b5de85fb776614f0e209cb952dcf9dc7db1979396b08d07','Handle beside opposite hip','Raise arm to the side',[
    'Stand tall beside a low cable with the handle beginning near the opposite hip and your elbow softly bent.',
    'Raise the arm out to the side to a comfortable height while keeping your torso and wrist neutral.',
    'Avoid leaning away, shrugging or swinging the handle through the bottom of the repetition.',
    'Use a light load and stop below shoulder height if a higher range is not comfortable.'
  ],'https://static.wixstatic.com/media/856ae2_0bedfdf259a24acdb58714cb7e20bef8~mv2.webp'),
  '1633':reviewed('1633','cable one arm preacher curl','cable',170900,'74929f9ca785f9d14f345b05f3012c195195f4e5878365d96c9f57d49510f5f5','Upper arm on preacher pad','Curl handle toward shoulder',[
    'Support the entire working upper arm on the preacher pad and hold the low cable with a palm-up grip.',
    'Curl the handle toward your shoulder while keeping the upper arm planted and wrist aligned.',
    'Avoid lifting the elbow from the pad, overextending the bottom or bending the wrist backward.',
    'Use a lighter load and stop just before full elbow extension if the bottom position is uncomfortable.'
  ],'https://static.wixstatic.com/media/856ae2_2747b6c226ea43b197acbf4e8ae24daa~mv2.webp'),
  '1267':reviewed('1267','cable one arm press on exercise ball','cable',157690,'fa2c16be6fbea39ac825366220cb887d581e23b79a78f6210aba34318eac3dca','Ball stable; handle at chest','Press above chest',[
    'Support your head and upper back on a stable exercise ball with feet wide and one cable handle at your chest.',
    'Press the handle above your chest while keeping your hips level and the ball from rolling.',
    'Avoid twisting toward the cable, dropping your hips or allowing your head to hang off the ball.',
    'Use a light load or a stable flat bench until you can control the ball through every repetition.'
  ],'https://static.wixstatic.com/media/856ae2_5a8ed78939e24373bdde87534ff0ea78~mv2.webp'),
  '3563':reviewed('3563','cable one arm pulldown','cable',168220,'4342d43fdbb6ac1ea094da642f0d1f986ec7e52a3816e5bd92e69213385a4501','Arm long at high cable','Pull elbow toward ribs',[
    'Face the high cable in a stable split or kneeling stance with one arm reaching overhead and shoulder controlled.',
    'Pull the elbow down toward your ribs without leaning backward or rotating your torso.',
    'Avoid yanking from the shoulder, flaring your ribs or turning the movement into a triceps press.',
    'Use a lighter load and a shorter overhead reach if you cannot keep the trunk still.'
  ],'https://static.wixstatic.com/media/856ae2_cf2098d0e4d548b2848854f2f77b0eea~mv2.webp'),
  '1635':reviewed('1635','cable one arm reverse preacher curl','cable',144984,'a4fbf4e526e352a6732dbb2ef08c9eb8fb7f9f37ba37729ae52a2a4edbc779ff','Overhand grip on preacher pad','Curl with palm down',[
    'Support the working upper arm on the preacher pad and hold the low cable with an overhand grip.',
    'Curl the handle upward while keeping the palm down, wrist neutral and upper arm fixed to the pad.',
    'Avoid lifting the elbow, collapsing the wrist or forcing the bottom into painful full extension.',
    'Use a light load and reduce the range if the forearm or elbow cannot stay comfortable.'
  ],'https://static.wixstatic.com/media/856ae2_682eaa451ac54c46a5087a818bcdce2d~mv2.webp'),
  '0193':reviewed('0193','cable one arm straight back high row (kneeling)','cable',145102,'d0c325ba34e98a9ae343679d2988c8fbd0b92627c7d8af1c2feccc1a785245de','Tall kneeling; arm reaches high','Row elbow straight back',[
    'Kneel tall facing a high cable with one arm reaching forward and your ribs stacked over your hips.',
    'Row the elbow straight back beside your ribs while keeping your shoulders and pelvis square.',
    'Avoid leaning backward, shrugging or rotating your torso to shorten the cable path.',
    'Use a light load and a half-kneeling stance if tall kneeling does not feel stable.'
  ],'https://static.wixstatic.com/media/856ae2_61c6b4551c6744838fab07bbf9592e5d~mv2.webp'),
  '1723':reviewed('1723','cable one arm tricep pushdown','cable',180658,'398e8b20bb2831a8bc20c89f91f9dad5f5567ebc26e976ceba4aa3f09def3673','Elbow bent beside ribs','Straighten arm downward',[
    'Stand beside the high cable with the working elbow close to your ribs and the handle near your chest.',
    'Straighten the elbow to press the handle down while keeping the upper arm and shoulder still.',
    'Avoid leaning over the handle, letting the elbow drift forward or snapping into lockout.',
    'Use a light load, neutral wrist and comfortable range; train both arms evenly.'
  ],'https://static.wixstatic.com/media/856ae2_6e16d47784654b2dba207a3eb301b781~mv2.webp')
})

export const APPROVED_CATALOGUE_BATCH18_IDS=Object.freeze(Object.keys(CATALOGUE_ART_BATCH18))
