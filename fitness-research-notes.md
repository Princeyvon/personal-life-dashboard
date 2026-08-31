# Fitness, nutrition, sleep, and symptom-tracking implementation notes

## User-provided workout plan
- Rotating 3-on, 1-off cycle: Push, Pull, Legs & Core, Rest.
- Push: bench press, incline dumbbell press, overhead press, lateral raise, chest fly, triceps rope pushdown, overhead triceps extension.
- Pull: deadlift/RDL, pull-ups/lat pulldown, barbell/dumbbell row, seated cable row, face pulls, biceps curl, hammer curl.
- Legs & Core: back squat, RDL/leg curl, lunges/split squat, leg press, calf raise, hanging leg raise/cable crunch, plank.
- User wants scheduled exercises, daily completion, weight, sets/reps/load, progress over time, and adjustable weekly plans.

## Evidence-based defaults
- ACSM 2026: consistency and individualization matter more than complexity; train all major muscle groups at least twice weekly for healthy adults; hypertrophy can use approximately 10 weekly sets per muscle group as a starting reference; equipment choice and training to failure are not mandatory for most healthy adults. Source: https://acsm.org/resistance-training-guidelines-update-2026/
- NHS healthy weight gain: add calories gradually; an adult may try roughly 300–500 extra calories daily, smaller frequent meals, protein foods, balanced food groups, and strength training; do not rely on chocolate/cakes/sugary drinks; sudden or unexplained weight loss merits clinician review. Source: https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/healthy-ways-to-gain-weight/
- CDC sleep: adults aged 18–60 generally need 7 or more hours; track bedtime, awakenings, wake time, naps, exercise, caffeine/alcohol, and medications; regular sleep problems or signs of sleep disorders should be discussed with a healthcare provider. Source: https://www.cdc.gov/sleep/about/index.html

## Product safety boundaries
- Health assistant should frame outputs as tracking, education, and questions to discuss with a clinician—not diagnosis or prescription.
- Symptom entries should capture onset, severity, duration, triggers, clinic visit, prescribed medication, and follow-up date.
- The product should surface urgent-care guidance for severe/red-flag symptoms via a clear safety notice, without diagnosing.
- Nutrition guidance should show adjustable meal templates and a conservative calorie-surplus starting point, not promise a precise result.
- Weight trend should use rolling averages to reduce noise; strength trend should compare best set/load and estimated progress, not raw single-day fluctuations.
- Voice is the primary input; text controls remain as accessible fallback.
