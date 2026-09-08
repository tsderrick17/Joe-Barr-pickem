update public.bowl_pool_games
set order_index = case provider_game_id
  when 'bowl-2026-gator' then 24
  when 'bowl-2026-music-city' then 25
  when 'cfp-2026-fiesta-quarterfinal' then 26
  when 'bowl-2026-reliaquest' then 27
  when 'bowl-2026-las-vegas' then 28
  when 'bowl-2026-texas' then 29
  when 'cfp-2027-cotton-quarterfinal' then 30
  when 'cfp-2027-peach-quarterfinal' then 31
  when 'cfp-2027-rose-quarterfinal' then 32
  when 'bowl-2027-citrus' then 33
  when 'bowl-2027-first-responder' then 34
  when 'bowl-2027-liberty' then 35
  when 'cfp-2027-orange-semifinal' then 36
  when 'cfp-2027-sugar-semifinal' then 37
  when 'cfp-2027-national-championship' then 38
  else order_index
end
where provider_game_id in ('bowl-2026-gator','bowl-2026-music-city','cfp-2026-fiesta-quarterfinal','bowl-2026-reliaquest','bowl-2026-las-vegas','bowl-2026-texas','cfp-2027-cotton-quarterfinal','cfp-2027-peach-quarterfinal','cfp-2027-rose-quarterfinal','bowl-2027-citrus','bowl-2027-first-responder','bowl-2027-liberty','cfp-2027-orange-semifinal','cfp-2027-sugar-semifinal','cfp-2027-national-championship');
