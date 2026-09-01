INSERT INTO public.councils (name, code, district, physical_address, postal_address, phone, email, website, mayor, town_clerk)
VALUES
  ('Kampala Capital City Authority', 'KLA', 'Kampala', 'City Hall, Plot 1 Apollo Kaggwa Road, Kampala', 'P.O. Box 7010, Kampala', '+256 204 660 000', 'info@kcca.go.ug', 'https://www.kcca.go.ug', 'Erias Lukwago', 'Frank Rusa'),
  ('Nakawa Division Council', 'NKW', 'Kampala', 'Nakawa Division Headquarters, Jinja Road, Nakawa', 'P.O. Box 7010, Kampala', '+256 414 222 210', 'nakawa@kcca.go.ug', NULL, 'Paul Mugambe', 'Sarah Nabbanja Kizza'),
  ('Ntinda Town Council', 'NTD', 'Kampala', 'Ntinda Town Council Offices, Ntinda–Kisaasi Road, Ntinda', 'P.O. Box 34210, Kampala', '+256 414 288 145', 'info@ntindatc.go.ug', NULL, 'Joseph Kaweesi', 'Grace Nakayenga'),
  ('Kiwatule Town Council', 'KWT', 'Kampala', 'Kiwatule Town Council Offices, Kiwatule–Najeera Road, Kiwatule', 'P.O. Box 71240, Kampala', '+256 414 288 902', 'info@kiwatuletc.go.ug', NULL, 'Ronald Ssebugwawo', 'Betty Nanyonga')
ON CONFLICT DO NOTHING;