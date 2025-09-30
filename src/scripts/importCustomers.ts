import { supabase } from '@/integrations/supabase/client';
import { parseCustomerData } from '@/utils/customerImport';

const customerData = `Aysegül Domke-Schreck		1	Försterkamp 5f, 30539 Hannover	Bemerode	12.12.1963	AOK Niedersachsen	F267085117	Nicht beantragt		Kasse		Aktiv	3	Mo-So				Apr-24	Sep-24	Beidseitiges Einverständnis/ Putzfirma und keine Betreuung sondern Ruhe	
Ferdinand Ursula	Sabino	1	Friedrich Silcher Str. 3, 30173 Hannover	Südstadt	18.06.1946	AOK Niedersachsen	H815832739		0511 88 26 76	Kasse		Aktiv	3	Do-Fr				Apr-24			
Steinmann Karin	Jil	2	Wallensteinstraße 108b, 30459 Hannover	Ricklingen	04.05.1944	BIGdirekt	K996486172	Fehlt		Kasse		Aktiv	6	Mo-Fr			Michaela Willicke (Tochter)	Apr-24			
Rost Insa	Alina	1	Kleestraße 22, 30625 Hannover	Kleefeld	28.06.1963	DAK	F570740469			Kasse		Aktiv	3	Mo-Sa				May-24			
Vordemann Sigrid 	Nadine	1	Mommsenstraße 10, 30173 Hannover	Südstadt	03.06.1942	DAK-Gesundheit	X195399934			Kasse		Aktiv	3	Mo-Fr		Frau		May-24			
Brockmann Edelgard	Jil	1	Lauenauer Str 17, 30459 Hannover	Ricklingen	23.07.1938	Barmer	U937118259			Kasse		Aktiv	3	Nicht Mo, Di nur 1-3				Jun-24			
Dr Walter Neumann	Florian	0	Am Listholze 29B, 30177 Hannover	List	11.10.1947			-		Privat		Aktiv	6	Fr				May-24			
Hoffmann Vera	Siska	2	Escherstraße 22A, 30159 Hannover	Mitte	8/27/1931	AOK Niedersachsen	R964342919	Ja 		Kasse	Mail an Bruder	Aktiv	6				Herr Tinschert	Jun-24			
von Ungern-Sternberg Ingrid 	Sabino	2	Bernwardstraße 36, 30519 Hannover	Döhren-Wülfel	11.04.1936	Techniker	X329978694	Fehlt	0511 83 14 81	Kasse		Aktiv	6					Jun-24			
Müller Karin	Jil	2	Bonhoeffer Str. 3, 30457 Hannover	Ricklingen	28.12.1956	Mobil Krankenkasse	Z211685368	Ja 	0179 939 8838	Kasse		Aktiv	6					Jun-24			
Willsch Edith	Nadine	2	Bandelstraße 10, 30171 Hannover	Südstadt	30.04.1930	Barmer	C349772798			Kasse		Aktiv	3	Do		Frau		Jun-24			
Niemeyer Vera	Jil	2	Friedländer Weg 27, 30459 Hannover	Ricklingen	20.09.1943	AOK Niedersachsen	S301857797	Ja	0511 447767	Kasse	Ja	Aktiv	12	Do				Aug-24			
Pinkepank Edda	Sabino	2	Davenstedter Holz 60, 30455 Hannover	Davenstedt	25.04.1941	Techniker	N289967540	-	0511 59 04 749	Kasse/Privat		Aktiv	6	Do			Sandra Jamm (Tochter)	Aug-24			
Rosebrock Ursel Marianne 	Sallinger	2	Louise-Schröder Straße 3, 30627 Hannover	Groß-Buchholz	31.01.1943	AOK Niedersachsen	N667509742	Ja 	0511 27 17 907	Kasse		Aktiv	6	Mi				Oct-24			
Rosebrock Hans- Hermann Werner 	Sallinger	2	Louise-Schröder Straße 3, 30627 Hannover	Groß-Buchholz	20.06.1940	AOK Niedersachsen	H274216549		0511 27 17 907	Kasse		Aktiv	0	Mi				Oct-24			
Neubauer Inge	Alina	2	Gollstraße 65, 30559 Hannover	Anderten	08.10.1940	IKK Classic	U880015963	Person fehlt		Kasse		Aktiv	3	Mo-Fr				Oct-24			
Dieckmann Ingelore	Alina	2	Kötnerhof 18, 30559 Hannover	Anderten	10.07.1941	AOK Niedersachsen	Y460957542		0511 54410455 / 0175 9807838	Kasse	Mail an Tochter	Aktiv	3	Di-Mi		Top	Ariana Tami ( Tochter) 0175 9783546	Nov-24			
Jacke Sabine	Nasja	1	Feldstraße 6, 31275 Lehrte	Lehrte	03.12.1956	AOK Niedersachsen	P535609661		05132 92 84 868	Kasse		Aktiv	3	Nicht Donnerstags, gerne Vormittags				Nov-24			
Sören Seebold	Jil	3	Ferdinand-Wilhelm-Fricke Weg 10, 30169 Hannover	Ricklingen	19.08.2003	TK	P589144338		0152 5422 7046	Kasse		Aktiv	3					Aug-24			
Jannes Günther	Jil	3	Ferdinand-Wilhelm-Fricke Weg 10, 30169 Hannover	Ricklingen	03.05.2003	VIACTIV	L177638266		0152 2752 3387	Kasse		Aktiv	3	Nicht Di 1,2, nicht Mi 2				Aug-24			
Köper Christine	Ilka	3	Hauptstraße 70B, 30916 Isernhagen	Isernhagen	10/4/1941	DKV 	KV203961575	Ja	05139 9588420	Kasse		Aktiv	6	Tag egal, am liebsten 10:15			Markus Köper (Sohn, 01725224180)	Nov-24			
Härtel Marlis	Gaby	2	Klabundestr. 3A, 30627 Hannover	Groß-Buchholz	08.02.1935	Barmer	N353186997	Fehlt	0511 57 28 94	Beihilfe		Aktiv	6	Morgens (Fr)			Katrin Härtel (Tochter) 0175 9028 060	Nov-24			
Schmidtmann Heinz	Gaby	2	Widemannstraße 3, 30625 Hannover	Kleefeld	26/03/1937	BARMER	T971668027		0511 633 763	Kasse		Aktiv	3	nicht Mi nicht morgens			0179 6666 878 Stühmann Kerstin, Tochter	Nov-24			
Rosenbaum Edelgard	Nadine	3	Böhmerstraße 31, 30173 Hannover	Südstadt	17/07/1938	AOK Niedersachsen	A984226266		0511 3735 7417;     0151 501 89 269	Kasse		Aktiv	3	Mi 15:30			0511 592 256 Rosenbaum-Wollers Birgit, Tochter	Nov-24		Ab November alle 2 Wochen Sabino um 15:30	
Schulze Ruth	Gaby	2	Müdener Weg 2, 30625 Hannover	Groß-Buchholz	6/7/1937	TK	N140088039		0511 575 673;          0151 288 88654	Kasse		Aktiv	3	Alle 2 W, Tag egal, 8:30			0163 563 7333 Schulze Stephan, Sohn	Nov-24			
Brandt Fred	Gaby	2	Rotekreuzstr. 46A, 30627 Hannover	Groß-Buchholz	2/7/1939	AOK Niedersachsen	H679873096	Ja 	0511 577 386;          0175 709 1850	Kasse		Aktiv	6	Tag egal 2,5			  Brandt Margarete, Ehefrau	Nov-24			
Brandt Margarete	Gaby	2	Rotekreuzstr. 46A, 30627 Hannover	Groß-Buchholz	29/06/1935	AOK Niedersachsen	K307377165	Ja 	0511 577 386;          0175 709 1850	Kasse		Aktiv	0	Tag egal 2,5			0511 6064 4715 Grauwinkel Monika, Tochter	Nov-24			
Hennemann Ursula	Alina	2	Zieglerhof 10, 30655 Hannover	Groß-Buchholz	6/1/1939	AOK Niedersachsen	Y488663211	Ja 	0511 549 0376;      0157 542 06508	Kasse		Aktiv	6	Nicht Di, lieber Morgens/Vormittags			0178 938 8904 Fuchs Oliver, Sohn	Nov-24		Termin noch verschieben	
Düsterdiek Wilfried	Sallinger	2	Kurt-Schumacher-Ring 7, 30627 Hannover	Groß-Buchholz	26/12/1938	TK	K370752702	Person fehlt	0511 572 114	Kasse		Aktiv	6	Mi 3		Sallinger	  Düsterdiek Erika, Ehefrau	Nov-24			
Bruns Gerhard	Gaby	2	Schweriner Str. 11, 30625 Hannover	Kleefeld	2/6/1936	DAK-Gesundheit	C380993125		0511 5551 87;        0160 997 04615	Kasse		Aktiv	3	tag egal: 15:30-1700			0157 516 79008 Lechler Viktoria, Enkeltochter	Nov-24			
Rademacher Rosemarie	Alina	1	Efeuhof 5, 30655 Hannover	Misburg	1/8/1946	DAK-Gesundheit	W007754611	-	0511 5911 05;        0152 519 83571	Kasse		Aktiv	3	Nicht Mo oder Do, erst ab 10		Direkt hintereinander mit Bloch	0172 298 4866 Swirczek Claudia, Tochter	Nov-24		Erstgespräch vereinbart	
Ludwig-Pascuti Christina	Alina	3	Stillerweg 13, 30655 Hannover	Groß-Buchholz	4/2/1943	AOK Niedersachsen	F631400915	Ja 	0511 6476 796	Kasse		Aktiv	6	Absoluter Wunschtermin Freitag 10:15, generell nur Vormittags			  Pascuti Johann, Ehemann	Nov-24		Erstgespräch vereinbart	
Ostermeier Ute	Nasja	3	Erlengrund 13, 31275 Lehrte	Lehrte	21/06/1938	DAK-Gesundheit	X512904121	Ja 	05132 93525	Kasse		Aktiv	3	Mo&Di ab 10, Do ab 12			0174 195 0331 Ostermeier Jörg, Sohn	Nov-24		Erstgespräch vereinbart	
Ostermeier Heinz	Nasja	3	Erlengrund 13, 31275 Lehrte	Lehrte	20/09/1939	DAK-Gesundheit	W641420472		05132 93525	Kasse		Aktiv	3	Mo&Di ab 10, Do ab 12		Mittlere Demenz, ehefrau und sohn kümmern sich	0174 195 0331 Ostermeier Jörg, Sohn	Nov-24		Erstgespräch vereinbart	
Rust Beate	Nasja	2	Sonnenweg 1D, 31275 Lehrte	Lehrte	26/07/1962	DAK-Gesundheit	R803269806	Ja	05132 57 862	Kasse		Aktiv	6	Di, Do Nachmittags			05132 599 1616 Seuss Mike, Schwäger	Nov-24		Erstgespräch vereinbart	
Walkenhorst Reinhilde	Alina	3	Kerbelweg 11, 30629 Hannover	Misburg	1/11/1937	DAK-Gesundheit	P290775059	Ja	0511-58 7645	Kasse		Aktiv	6	Vormittags			  Walkenhorst Klaus, Ehemann	Nov-24		Erstgespräch vereinbart	
Bloch Anna	Alina	3	Efeuhof 5, 30655 Hannover	Misburg	14/12/1942	AOK Niedersachsen	J159340572	Ja (Arzttermine darüber)	0511 696 5506; 0157 3183 3603	Kasse		Aktiv	3	Egal, einfach mit Rademacher absprechen			0163 8730 971 Bloch Viktor, Sohn	Nov-24		Erstgespräch vereinbart	
Thomas Helga	Alina	2	Schweriner Str. 19, 30625 Hannover	Kleefeld	22/11/1961	AOK Niedersachsen	U400096669		0511 588 836; 0157 585 46305	Kasse		Aktiv	3	Di/Do 16:00			0511 71 3550 Seidel Renate, Freundin	Nov-24			
Thies Christa	Nasja	4	Feldstr. 51A, 31275 Lehrte	Lehrte	4/12/1939	BARMER	R450702824	Ja	05132 888 6634	Kasse		Aktiv	6	Mo, Mi ab 12, Di, Do ab 10, Fr nicht			05066 610 262 Genth Angela Viktoria, Tochter	Nov-24		Möchte nur, dass wir gemeinsam mit Oksana kommen, ist immer Dienstags vormittags	
Schröder Helga	Nasja	2	Richterweg 19, 31275 Lehrte	Lehrte	10/7/1936	DAK-Gesundheit	O929584785	Feht	05132 4205	Kasse 		Aktiv	3	Völlig flexibel, bisher Donnerstag 12:30		Immer gemeinsam mit Sohn Matthias, jeder hat einen Termin m Monat	05132 923 7232; 0172 6979 501 Schröder Christina, Tochter	Nov-24		Erstgespräch vereinbart	
Götze Kurt	Nasja	2	Depenauer Ring 26, 31275 Lehrte	Lehrte	29/09/1937	Knappschaft	Y454494526	Ja	0160 9348 7778	Kasse 		Aktiv	6				0179 501 0054 Wieczorek Ruth, Schwester	Nov-24		Erstgespräch vereinbart	
Linde Egon	Gaby	2	Schweriner Str. 11, 30625 Hannover	Kleefeld	29/04/1943	AOK Niedersachsen	K789311169		0511 586 461	Kasse		Aktiv	3	Tag egal: 8:30 o nachmittag		hat leichte demenz, sohn kümmert sich um alles	0162 4269 431 Linde Dirk, Sohn	Nov-24			
Wissmann Irmgard	Gaby	3	Bergener Str.1, 30625 Hannover	Groß-Buchholz	28/01/1949	BARMER	N821257590	Ja	0172 811 6336	Kasse		Aktiv	6	Mo ab 12			0173 8222 093 Wissmann Christian, Sohn	Nov-24			
Simon Peter	Gaby	2	Winsener Str. 19, 30625 Hannover	Groß-Buchholz	4/11/1934	Techniker	D881964680		0511 575 669	Kasse		Aktiv	3	Termin 2 oder 3			  Simon Hannelore, Ehefrau	Nov-24			
Schmidt Anita	Sallinger	3	Sperlingsfeld 6, 30627 Hannover	Groß-Buchholz	31/12/1927	BARMER	J781746832	Ja 	0511 5711 12	Kasse		Aktiv	6	Di-Do ab 10:15		leichte demenz, sohn kümmert sich um vieles	0176 7674 6809 Schmidt Burkhard, Sohn	Nov-24			
Schröder Matthias	Nasja	1	Richterweg 19, 31275 Lehrte	Lehrte	23/04/1965	DAK-Gesundheit	W236163828		05132 851 7223	Kasse		Aktiv	3	Völlig flexibel, bisher Donnerstag 12:30		Immer gemeinsam mit Mutter Helga, jeder hat einen Termin m Monat	   ,  	Nov-24		Nicht erreicht, mit Helga Schröder am Mittwoch zusammenlegen	
Hennecke Johanne	Nadine	3	Jordanstr. 31, 30173 Hannover	Südstadt	6/7/1938	BARMER	B830525026	Fehlt	0159 063 64894	Kasse		Aktiv	6	Mo, Fr komplett, Mi nur Vormittags, lieber Vormittags, aber auf keinen Fall vor 10		mittlere demez, tochter kommert sich	0159 0636 4894 Oliver Katrin, Tochter	Nov-24		Erstgespräch vereinbart	
Becker Edith	Nadine	2	Apenrader Str. 55, 30165 Hannover	Vahrenwald	03.08.1932	AOK Niedersachsen	X171245576	Beantragt	0511 350 57 17	Beihilfe		Aktiv	6	Nicht Do morgen		Frau, Rechnung an Neffen	Oliver Hanekopf, Peterskamp 7, 30880 Laatzen	Nov-24			
Berkholz Irene	Luca	1	Schuhstraße 1, 30159 Hannover	Mitte	23.07.1939	Techniker	Y615795304		0511 35 30 350	Kasse		Aktiv	6	Mi, Do 2,3,4		Jahr wöchentlich		Nov-24			
Konrad Anke	Nasja	2	Riegelstr. 33, 31275 Lehrte	Lehrte	8/29/1961	AOK Niedersachsen	E227950489	Ja 	05132 56 061; 0151 666 25	Kasse		Aktiv	6	Mi/Do 2, 3 (4), Fr 2, 3				Nov-24		anfängliche demenz, mann kümmert sich	
Schröder Stefan	Gaby	1	Meitnerstraße 5C, 30627 Hannover	Groß-Buchholz	28.04.1960	BARMER	H085767942		0176 2196 5663	Kasse		Aktiv	3	Mi komplett, Mo erster oder letzter Termin, Di und Do ab Mittag				Nov-24			
Walter Marianne	Alina	1	Schierholzstr. 61, 30655 Hannover	Misburg	9/15/1945	KKH	N747904681		0511 6499 569	Kasse		Aktiv	3	Do 2-4		Putzfirma? Mal sehen	3x nicht erreicht, auf Mailbox gesprochen	Nov-24			
Robrade Gisela	Nasja	1	Feldstraße 6, 31275 Lehrte	Lehrte	20.09.1953	AOK Niedersachsen	K698593610		05132 53805	Kasse		Aktiv	3	Flexibel				Nov-24			
Heckmann Anastasia	Jil	2	Göttinger Chaussee 29, 30453 Hannover	Ricklingen	08.04.1993	DAK-Gesundheit	V275728786	Fehlt	0176 23306085	Kasse		Aktiv	6	Egal, nicht 1		Möchte so oft wie möglich zusätzlich Fahrtdienst zum Arzt	0163 1751236 Siefker Florian	Dec-24			
König Margitta	Jil	2	Kneippweg 1, 30459 Hannover	Ricklingen	12/5/1940	Barmer	O528653320	Ja 	0511 234 45 70 / 0177 234 45 70	Kasse		Aktiv	6	Mo-Fr  2-5			0170 / 10 66 777 Stefanie König ( Tochter)	Dec-24			
Wolf Christel	Jil	1	Lessingstraße 15, 30457 Hannover 	Wettbergen	13.12.1938	Barmer	U620893931		0511 431245	Kasse 		Aktiv	3	Nicht Mo & Mi 1-3			0163 2559312 Wolf Matthias, Sohn	Dec-24			
Hartwig Elisabeth	Alina	2	Winkelriede 5, 30627 Hannover	Groß-Buchholz	6/14/1942	Barmer	H661940341	Ja & Sachleistung	0178 350 1796	Kasse		Aktiv	12	Do 3			0172 4414 220 Angelika Dochow, Stieftochter?	Dec-24			
Schwarz Gabriele	Alina	2	Berckhusenstraße 46, 30625 Hannover	Kleefeld	8/30/1955	Barmer	W144625312	Ja	0151 611 214 16	Kasse		Aktiv	6	Nachmittags, nicht  Di			Christin Bothe, 0151/61610852, Tochter	Jan-25			
Krautmacher Elke	Alina	1	Waldstraße 11A, 30629 Hannover	Misburg	3/8/1946	AOK Niedersachsen	K440657869		0176 97456532	Kasse		Aktiv	3	Muss der Fette wissen			David Krautmacher, 01522 904314, Sohn	Dec-24			
Dormeier Ruth	Jil	2	Göttinger Landstraße 31, 30966 Hemmingen	Hemmingen	06.02.1936	Barmer	W494754700	Ja 	0511 429322	Kasse		Aktiv	6	Mo, Mi, lieber 5, sonst 4 ok			015207429045 / 0511 2330949 / heipelufe@gmx.de, Heike Dormeier (Tochter), 0511 2330050 Dagmar Dormeier (andere Tochter)	Jan-25			
Spitzenberg Irmtraut	Celina	2	Keuperweg 29, 30455 Hannover	Davenstedt	05.09.1943	Debeka		Fehlt	0179 3991426	Beihilfe		Aktiv	6			Servicenummer Debeka: 2672307.8 ; Personalnummer Beihilfe: 0001067356Sonstiges Alles auf eine Rechnung		Jan-25			
Misikowski Anne 	Jil	1	Dannenbergstraße 18, 30459 Hannover	Ricklingen	31.5.1992	DAK 	F020903305	-	0177 3816464	Kasse		Aktiv	3	Flexibel			Leon Dvoracsek (Partner) 015730717881	Feb-25			
Stöter Michael	Meliha	1	Ottostraße 46, 30519 Hannover	Döhren-Wülfel	18.03.1964	BKK M+	M874593341	- 	01522 8336433	Kasse 		Aktiv	3				Winkler Stefanie (Betreuerin) 0155 66036011	Feb-25			
Engel Adelheid	Siska	1	Stammestraße 18, 30459 Hannover	Ricklingen	3/2/1941	Techniker	J098400448	- 	0511 414518	Kasse 		Aktiv	3				Christine Engel (Tochter) 0177 4138717	Feb-25			
Kral Brigitte	Sabine	1	Am Sünderkamp 41, 30629 Hannover	Misburg	6/11/1945	Barmer	S270095235	-	0511 58 71 07	Kasse 		Aktiv	6	Mi, Fr 1,2		Halbes Jahr wöchentlich		Mar-25			
Korn Bärbel	Siska	2	Heinrich-Heine Straße 32, 30173 Hannover	Südstadt	10/10/1940	Barmer	A845285083	-	0511 80 91 442	Kasse 	Ja	Aktiv	3	Mo- Do 2,4				Mar-25			
Korn Friedel 	Siska	2	Heinrich-Heine Straße 32, 30173 Hannover	Südstadt	3/20/1938	Barmer	Y022849845	-	0511 80 91 442	Kasse 	Ja	Aktiv	3	Mo- Do 2,4				Mar-25			
Düwel Horst	Alina	2	Konderdingstraße 17, 30539 Hannover	Mittelfeld	02.02.1939	Postbeamtenkrankenkasse	900003389		0511 522215	Privat		Aktiv	3				Tochter Laura Düwel 015144975302 oder Pflegedienst Balance GmbH 0511 39721484	Mar-25			
Düwel Ingrid	Alina	2	Konderdingstraße 17, 30539 Hannover	Mittelfeld	10.08.1942	Postbeamtenkrankenkasse	0900003389L709		0511 522215	Privat		Aktiv	3				Tochter Laura Düwel 015144975302 oder Pflegedienst Balance GmbH 0511 39721484	Mar-25			
Siekmann Andreas	Meliha	2	Ahornstraße 10, 30519 Hannover	Bemerode	02.03.1964	Barmer	M177990539	Nur EB	0511 9805179	Kasse 		Aktiv	6	Nicht Mo,Mi, Fr 1-3, generell nicht 1			Yvonne Siekmann (Frau) 0170 2360563	Mar-25			
Schulenburg Ursula	Meliha	1	Schweriner Str 8, 30625 Hannover	Kleefeld	8/5/1941	AOK Niedersachsen	V835681299	-	0511 59 40 839	Kasse 		Aktiv	6	Nicht Do, 1,2		Jahr wöchentlich	Schwester Christa Wecke, 0511 59 25 07	Mar-25			
Gollub Ingrid	Alina	2	Heidering 6, 30625 Hannover	Groß-Buchholz	6/19/1937	BARMER	X626003990	Ja	0511 57 36 89	Kasse 		Aktiv	6	1.2		Frau		Mar-25			
Richter Heinz	Nasja	3	Iltener Straße 21, 31275 Lehrte	Lehrte	22.02.1929	Techniker	B115954802		05132 8321223	Privat (An Tochter)		Aktiv	6	Egal, nicht 1			Silvia Pflägig, Am Gutspark 42, 30539 Hannover, 0160 8544589	Mar-25			
Nitschke Torsten	Meliha	2	Kolumbusstraße 5, 30519 Hannover	Mittelfeld	11/20/1967	AOK Niedersachsen	W071430702	Ja	0176 47013383	Kasse 		Aktiv	6	1-5, Gerne Do-Fr Vormittag, aber geht immer				Mar-25			
Zurlo Gabriele	Nasja	2	Feldstraße 47, 31275 Lehrte	Lehrte	27.02.1965	BIG Direkt	F383527523	Beantragt	05132 9238119	Kasse 		Aktiv	6	Egal 		Unfassbar fetter Sohn	Tizian Zurlo (Sohn) 0176 63496781	Mar-25			
Klawonn Heidrun	Celina	2	Rosenweg 4, 30457 Hannover	Wettbergen	20.04.1967	Techniker	F469765797		0511 468373	Kasse 		Aktiv	3	Mo-Mi nicht Mittags, Do nur 1, Fr nur 3		Extra Termine für Gardinen und Fenster machen	Bernd Klawonn (Ehemann)	Apr-25			
Hoffmann Jutta	Theresa	2	Franz-Bork Straße 7, 30163 Hannover	List	12/31/1959	AOK Niedersachsen	Z820294465	-	0157 5053 453	Kasse 		Aktiv	3	Mo 1-5, Fr 1-5				Mar-25			
Schöner Wolfgang	Meliha	2	Storchenwiese 23, 30627 Hannover	Groß-Buchholz	11/6/1946	UKV	KK-0155-1165	Beantragt	0175 4122 413 	Privat		Aktiv	6					Apr-25			
Fribow Lothar	Nasja	2	Neue Wietze 12F, 30657 Hannover 	Bothfeld	11.10.1938	Techniker	W012424354	Nein 	0511 6041769	Kasse 		Aktiv	3	Am liebsten Di Vormittag, sonst flexibel				Apr-25			
Fribow Margot	Nasja	2	Neue Wietze 12F, 30657 Hannover 	Bothfeld	24.12.1938	Techniker	H522577835	Nein  	0511 6041769	Kasse 		Aktiv	3					Apr-25			
Eichenberg Heide	Celina	1	Am Deichhof 18, 30459 Hannover	Ricklingen	02.12.1941	BKK Deutsche Bank AG	Z802483728		0511 415577	Kasse 		Aktiv	3	Nicht Mo/Di, nur 1,2, am liebsten Do				Apr-25			
Hohnsbein Steffen	Celina	4	An den Papenstücken 10, 30455 Hannover	Linden	20.10.1974	Mobil Krankenkasse	E136267896	Nächstes Jahr		Kasse 	Ja per Mail	Aktiv	6	Bis zu den Sommerferien geht nur Dienstag 15:00/15:30(lieber 15:00)		Mathe Nachhilfe für Sohn		Apr-25			
Fistinios Anastasios	Lisa	1	Nordstr 22, 30926 Seelze	Seelze	4/30/1964	AOK Niedersachsen	C919681047		0151 2960 1129	Kasse 		Aktiv	3					Apr-25			
Axiomakarou Stasa	Lisa	2	Nordstr 22, 30926 Seelze	Seelze	1/1/1966	AOK Niedersachsen	O171018957		0179 5019903	Kasse 		Aktiv	3					Apr-25			
Klages Malik Younes	Ilka	3	Riemer Hof 11, 30853 Langenhagen	Langenhagen	04.05.2022	AOK Niedersachsen	M851761808	Fehlt	0173 4515834	Kasse 		Aktiv	6	Mo, Di, Do ab 14:00		Mal Haushalt, mal Kinderbetreuung	Meryem Yasemin Klages (Mutter) 	Apr-25			
Vargas-Ferrer Veronika	Alina	1	Waldstraße 19C, 30629 Hannover	Misburg	12/22/1950	Barmer/ Postbeamtenkasse	N636866205/ 0900018852		0173 822 1613	Kasse 		Aktiv	3	Di 2				Apr-25			
Gallasch Franziska	Meliha	2	Sudenburger Wende 4, 30625 Hannover	Groß-Buchholz	11/16/1994	IKK Brandenburg & Berlin	V160135133	Beantragt	0162 6854 225	Kasse 		Aktiv	6	Mo-Fr 2-5, DOnnerstag 14:30 Physio			Kai Frense(Betreuer) 01577 4328263	Apr-25			
Freitag Lieselotte	Siska	2	Harenberger Str. 14, 30453 Hannover	Linden	7/20/1939	BARMER	W101614457	Beantragt	0511 210 06 29/ 0171 1212 620	Kasse 		Aktiv	6	Mo/Mi 2-5				Apr-25			
Strietzel Ursula	Alina	1	Ottweiler Str 14E, 30559 Hannover	Bemerode	8/28/1927	DKV	KV203916804		0511 52 66 34	Privat		Aktiv	3	Fr 2,3		Auto, Ab juni	Wolfgang Strietzel (Sohn) 0176 6428 0104	Apr-25			
Kehrwieder Herbert	Meliha	1	An der Lindenhecke 11, 30559 Hannover	Bemerode	6/2/1939	Debeka	9324138-0		0511 52 60 80	Privat		Aktiv	6	Mo,Di,Do 2-5		Frau, Ab Juni, Stundenkonto machen	Wolfgang Strietzel (Sohn) 0176 6428 0104	Apr-25			
Bartels Ilse	Theresa	1	An der Lutherkirche 11, 30167 Hannover	Vahrenwald	10/9/1934	DAK-Gesundheit	T824362636		0511 717 848	Kasse 		Aktiv	6	Mo-Mi 2-5		Erstmal wöchentlich		May-25			
Loh Volker	Celina	1	Wolkerhof 5, 30455 Hannover	Linden	11.09.1959	Pronova BKK	O170095857		0162 3449805	Kasse 		Aktiv	3	Nicht 1, Tag egal			Heike Pobantz 0176 40013599	May-25			
Gröger Ralph	Celina	2	Albrecht-Schäffer-Weg 79, 30455 Hannover	Linden	30.08.1956	AOK Niedersachsen	B350941977	Nächstes Jahr	0175 3360204	Kasse 		Aktiv	6	Egal			Yvonne Kindervater, Albrecht-Schaeffer-Weg 81B, 01747085573	May-25			
Farnbacher Gerda	Celina	1	Dannenbergstraße 5, 30459 Hannover	Ricklingen	23.05.1945	DAK-Gesundheit	M667225378		0511 421094	Kasse 		Aktiv	3	Nicht Do, nicht 1			Jörg Fuhse, Dannenbergstraße 5, 0511 424311	May-25			
Festerling Alfons	Salinger	2	Uhlhornstraße 10, 30625 Hannover	Kleefeld	11/28/1937	Heimatkrankenkasse	C798214282	Ja	0511 55 65 61	Kasse 		Aktiv	6	Mo-Fr 2		Ab Juni,Mann		May-25			
Wolynski Andrea 	Meliha	3	Dorfmarkhof 10, 30625 Hannover	Groß-Buchholz	11/16/1968	DAK-Gesundheit	G212223748	-	0176 6323 2083	Kasse 		Aktiv	6	Mo 3,4 Fr 3,4				May-25			
Niehof Hans-Detlef	Meliha	2	Schüttlerstraße 6, 30171 Hannover	Südstadt	1/20/1937	AOK Niedersachsen	K531673330	Beantragt	0176 9617 6826	Kasse 		Aktiv	6	Mo,Mi,Fr 4,5 Di,Do 5				May-25			
Zimmermann Hildegard	Alina	2	Wilhelm-Tell-Straße 30, 30629 Hannover	Misburg	6/9/1941	Techniker	F674549343	Beantragt	0511 59 14 15 / 0176 5515 4414	Kasse 		Aktiv	6	Mo, DI, Fr 2-5, gerne dienstag 2				May-25			
Rust		2	In den Sieben Stücken 5B, 30627 Hannover	Misburg		AOK Niedersachsen		Beantragt		Kasse 		Aktiv	3	Mi 1,2		Im September nochmal melden		May-25			
Emmermann Waltraut	Nadine	2	Apenrader Straße 55, 30165 Hannover	Vahrenwald	21.03.1936	Postmeamtenkrankenkasse / Beihilfe	O900003681	-	0511 3500754	Beihilfe 70/30		Aktiv	3	Nach Edith Becker			Frau Weidele (AWO) 0162 7452562	May-25			
Giesecke Hannelore	Celina	2	Rudolfstraße 2, 30457 Hannover	Ricklingen	21.12.1934	AOK Niedersachsen	T392372318	- 	0511 465554	Kasse 	Ja (an Sohn)	Aktiv	3	flexibel			Darg Giesecke (Sohn), Pattenser Feldweg 56, 30966 Hemmingen, 0152 08543368	May-25			
Mauracher Hans	Celina	2	Rudolfstraße 2, 30457 Hannover	Ricklingen	 21.03.1935	BKK Pronova	O259582021			Kasse		Aktiv	3	flexibel				May-25			
Burrichter Giesela	Celina	2	Berliner Straße 45a, 30457 Hannover	Wettbergen	6/6/1939	Techniker	I826339101	-	01575 1410021	Kasse 		Aktiv	3	Arztfahrten				May-25			
Burrichter Olaf	Celina	1	Berliner Straße 45a, 30457 Hannover	Wettbergen	28.01.1941	Knappschaft	H342468379		0177 9543187	Kasse 		Aktiv	3	Mi am liebsten, sonst Fr 4/5				May-25			
Lorke Eva-Christiane		2	Geibelplatz 7, 30173 Hannover	Südstadt	6/12/1953	BARMER	K853565837	Fehlt noch	0511 817208	Kasse 		Aktiv	6	Nicht Do, nur 2, notfalls 3		Finanzierung klären		May-25			
Stanke Barbara	Nasja	1	Dunantstraße 5, 30179 Hannover	Vahrenheide	6/9/1951	Techniker	X096718578	-	0177 47 57 586	Kasse 		Aktiv	3	Mo-Fr 2-5				May-25			
Gieseler Annelies	Meliha	2	Strelitzer Weg 8, 30625 Hannover	Kleefeld	1/2/1938	Bahn BKK	Z364624402	Beantragt	0511 55 72 52 	Kasse 		Aktiv	6	Mo, Mi-Fr 1,2		Frau		May-25			
Deppe Heinz	Meliha	2	Schierholzstraße 17A, 30655 Hannover	Groß-Buchholz	1/4/1939	AOK Niedersachsen	E264013641	Beantragt	0511 57 82 43	Kasse 		Aktiv	6	Mo-Fr 4,5			Detlef Deppe (Sohn) 0176 4777 2203	May-25			
Busch-Münchhalfen Heidemarie	Bernhard	2	Bernstraße 12, 30175 Hannover	List	6/30/1943	DAK-Gesundheit	M740482418	Beantragt	0511 34 21 18	Kasse 		Aktiv	12	Mo-Fr 3,4				May-25			
Buchholz Dr. Wolfgang	Meliha	1	Milanstraße 6, 30627 Hannover	Groß-Buchholz	1/10/1939	Continentale	9988572	-	0511 81 94 30	Privat		Aktiv	3	Mo-Fr 1,2			Frau 0175 4444490	May-25			
Schäumer Klaus	Alina	2	Fehrenwinkel 17, 30655 Hannover	Misburg	3/26/1939	AOK Niedersachsen	J620850104	Beantragt		Kasse 		Aktiv	6	Mo-Fr 5							
Dickneite		4	Ostergrube 2, 30559 Hannover	Anderten		DAK-Gesundheit				Kasse 		Aktiv									
Claes Wilbert		1	Gibraltarweg 13, 30165 Hannover	Vahrenwald						Privat		Aktiv									
Kis Karlo	Theresa	1	An der Lutherkirche 11, 30167 Hannover	Vahrenwald	09.07.1970	AOK Niedersachsen	G143093442	-	0511 2608 6242	Kasse 		Aktiv	3	Mo-Fr 3-5							
Riefenstahl Peter	Meliha	2	Ellerstraße 41, 30175 Hannover	Südstadt	3/24/1940	BARMER	L897827066	Fehlt noch	0511 95 23 326	Kasse 		Aktiv	6	Di, Do 4,5							
Krause Nora	Celina	2	Kreipeweg 13, 30459 Hannover	Ricklingen	16.07.1932	DAK-Gesundheit	F877098199	Nächstes Jahr	0511 415050	Kasse 		Aktiv	6	2 oder 5, lieber zum Ende der Woche			Estermann Carmen (Tochter) 05109 1654				
Nikolaus Uta	Ilka	2	Jadeweg 15, 30851 Langenhagen	Langenhagen	15.05.1943	AOK Niedersachsen	W633141645	Fehlt noch	0176 80043858	Kasse 		Aktiv	6	Ab 10, Tag egal							
Deike Bärbel	Celina	1	Heinrich-Hoff-Straße 6, 30453 Hannover	Linden	16.01.1947	AOK Niedersachsen	C506742164		0511 483639	Kasse 		Aktiv	3	Di, Do ab 10							
Grieger Sarah	Celina	2	Nettemannstraße 12, 30459 Hannover	Wettbergen	14.12.1979	Bahn BKK	O467056624	-	0163 3118237	Kasse 		Aktiv	3	flexibel							
Machholz Renate	Nasja	2	Uslarplatz 3a, 30659 Hannover	Vahrenheide	26.06.1941	AOK Niedersachsen	J558926187	-	0511 6497565	Kasse 		Aktiv	3	1,2 Tag egal							
Stürmer Christa	Alina	1	Bergiusstraße 33, 30655 Hannover	Groß-Buchholz	25.01.1939	AOK Niedersachsen	K541932650		0511 572754	Kasse 		Aktiv	3	Ab 10, Tag egal			Heike Gittner (Tochter), Bergiusstraße 31, 0176 1445062				
Witte Marlis	Florian	2	Froschkönigweg 15, 30179 Hannover	Vahrenheide	11/24/1937	BKK24	A217847656	-	0152 2984 7049	Kasse 		Aktiv	3	1.2							
Stahlhuth Ursula	Nasja	2	Ludwig-Sievers-Ring 42, 30659 Hannover	Vahrenheide	06.07.1939	Pronova BKK	T951168337		0511 6043352	Kasse 		Aktiv	3	Nicht Mi, nicht Di Nachmittags, sonst ab 10							
Bertram Hildegard	Nasja	2	Baldurstraße 9, 30657 Hannover	Vahrenheide	28.11.1936	Barmer 	X902492584	Beantragt	0511 6045402	Kasse 		Aktiv	6	Nicht 1			Claudia Hill (Tochter) 0511 95480738				
Brand Lennox 	Meliha	3	Nestroyweg 6, 30173 Hannover	Südstadt	8/2/2010	Techniker	V301962504	Noch nicht	0173 2075 574	Kasse 		Aktiv	6								
Budach Margit	Alina	2	Senator Bauer Straße 1, 30625 Hannover	Kleefeld	9/16/1936	Pronova BKK	I135347424	Beantragt	0511 55 63 91	Kasse 		Aktiv	6	2-May			Anina Budach (Enkelin)  0176 820 95968				
Rofalski Doris	Siska	2	Hurlebuschweg 10, 30453 Hannover	Linden	10/30/1943	DAK-Gesundheit	R483271714	Beantragt	0511 210 25 45	Kasse 		Aktiv	12	Mo-Do 4,5							
Hallmann Sabine	Bernhard	3	Stärkestraße 16, 30451 Hannover	Linden	9/17/1957	BARMER	M274839894	Beantragt	0160 9276 4228	Kasse 		Aktiv	6	Mo-Fr 3-5							
Ignatzi Werner	Lisa	1	Düsterstr 9, 30459 Hannover	Ricklingen	10/8/1954	BARMER	P010900308	-	0178 550 3580	Kasse 		Aktiv	3								
Birkner Heidrun	Celina	1	Am Ginsterbusch 52, 30459 Hannover	Ricklingen	26.05.1944	Techniker	I322450672		0511 5341840	Kasse 		Aktiv	3								
Hanna Bärbel	Alina	1	Am Blauen See 22, 30629 Hannover	Misburg	1/30/1955	AOK Niedersachsen	T883179390	-	0151 41384487	Kasse 	Ja	Aktiv	3	2,3,4,5							
Sieberichs Eva-Maria	Alina	2	Rosalind Franklin Allee 44, 30539 Hannover	Bemerode	2/21/1944	Debeka		-	0511 26 26 41 22	Beihilfe		Aktiv	3				Dirk Sieberichs(Sohn) 0172 204 5184				
Henneke Bianca	Theresa	3	Im Kreuzkampe 17, 30655 Hannover	List	10/4/1978	Barmer 	U881571392	Beantragt	0511 3701 9915	Kasse 		Aktiv	6								
Henze Claudia	Siska	1	Ricklinger Stadtweg 9, 30459 Hannover	Ricklingen	27.07.1964	AOK Niedersachsen	Y214990439	-	0178 21747777	Kasse		Aktiv	3								
Johannesson Elke	Bernhard	1	An der Bauerwiese 15, 30459 Hannover	Wettbergen	28.07.1942	DAK-Gesundheit	R572793671		0511 422104	Kasse 		Aktiv	3	Ab 12, Tag egal							
Jonczyk Ulrich	Ilka	3	Hägewiesen 117g, 30657 Hannover	Vahrenheide	22.09.1951	VRK und Beihilfe	365070704-E		0511 6040891	Privat (an Sohn)		Aktiv	12	Mo, Mi flexibel, Fr nur Nachmittags			Benjamin Wiedemann (Sohn), Vahrenwalder Straße 88,30165 Hannover, 0176 45737059				
Rüdiger Cornelia	Nasja	1	Wilhelmstraße 8, 31275 Lehrte	Lehrte	26.06.1953	AOK Niedersachsen	X269019548		0178 3575932	Kasse 		Aktiv	3	flexibel			Melanie Westermann 0160 7909994				
Wunder Dorothea	Nasja	2	Salzwedeler Hof 3, 30679 Hannover	Vahrenheide	26.04,1940	Debeka			0511 602517	Privat  		Aktiv	6								
Przybilla Rita	Lisa	1	Martinihof 5, 30455 Hannover	Linden	24.12.1952	AOK Niedersachsen	C468631504		0511 497607	Kasse 		Aktiv	6	3 oder 4, am liebsten Fr 4, sonst auch anderer Tag möglich			Heinz Dieter Przybilla (Ehemann) 0173 6386594				
Weber Laura	Lisa	2	In der Rehre 11, 30457 Hannover	Wettbergen	13.09.2013	AOK Niedersachsen	D412203677	-	0179 9489294	Kasse 		Aktiv	3	Mo flexibel, Fr Vormittags, sonst nicht			Melanie Weber (Mutter)				
Ursula Groot	-	2	Loccumer Straße 41, 30519 Hannover	Döhren-Wülfel	30.01.1935	AOK Niedersachsen	W794244915			Kasse		Aktiv	0			Nur Fenster					
Bandemer Claudia	Alina	1	Johanneskamp 8, 30539 Hannover	Bemerode	13.04.1981	KKH	Z659470071		0176 8434 9435	Kasse		Aktiv	3								
Stresing Irmgard	-	2	Bevenser We g 10, 30627 Hannover	Groß-Buchholz	28.09.1942	AOK Niedersachsen	U716027691	-	0152 0800 1456	Kasse		Aktiv	0			Fahrten					
Dohne Ingrid	Theresa	2	Spargelweg 10, 30419 Hannover	Herrenhausen	03.02.1941	AOK Niedersachsen	J883330655	-	0171  5251 901	Kasse		Aktiv	3	Mo-Fr 3-5							
Petersen Sylvia	Theresa	1	Maßmannstraße 5, 30165 Hannover	Vahrenwald	18.03.1960	BARMER	I528156614		0151 7285 7380	Kasse		Aktiv	3	Mo-Mi, Fr 3-5		Frau					
Mennecke Wolfram	Alina	2	Kirchröder Str 54C, 30625 Hannover	Kleefeld	22.12.1939	BARMER	I174238849	-	0511 53333 585	Kasse		Aktiv	3	Mi,Do  1,2		Frau					
Mennecke Gerda	Alina	1	Kirchröder Str 54C, 30625 Hannover	Kleefeld	02.05.1939	BARMER	H577260182		0511 5333 585	Kasse		Aktiv	3	Mi,Do  1,2		Frau					
Stahmer Dieter	Meliha	2	Am Leinewehr 35, 30519 Hannover	Döhren-Wülfel	05.04.1940	AOK Niedersachsen	S908860517			Kasse		Aktiv	6	Do 2,3							
Guttenberger Manfred	Ilka	2	Oppersheide 5, 30916 Isernhagen	Isernhagen	02.12.1955	Techniker	A465254254	Beantragt	0159 01743961	Kasse 		Aktiv	6	Ab 11, Fr erst später			Kerstin Guttenberger (Ehefrau) 				
Meyer Ingeborg	Meliha	2	Auf dem Emmerberge 36, 30169 Hannover	Südstadt	30.05.1937	Barmer 	P362115335	-	0511 887273	Kasse 		Aktiv	3	Zwischen 10-14, am liebsten Do, sonst Mo		Altbau ganz oben	Cornelius Meyer 01777676248				
Krause Horst	Ilka	2	Böhmeweg 16, 30851 Langenhagen	Langenhagen	06.12.1934	Mobil	D605917168	-	0511 732723	Kasse 		Aktiv	6	Mo, Mi, Fr 2,3,5, lieber 2,3			Angelika Perschel 0178 6884798 / Annette Krause 0177 3217696 (Töchter)				
Salinger Tobias	Theresa	2	Weidendamm 63, 30167 Hannover	Nordstadt	11.04.1977	DAK-Gesundheit	P822217782	?	0511 1316936	Kasse 		Aktiv	6	Mo, Do ab 12, lieber Mo			Cynthia Salinger 0172 4342537				
Städing Christina	Celina	2	Am Freihof 2, 30952 Ronnenberg	Ronnenberg	04.03.1969	Die Continentale (privat) + Beihilfe	Nr: 002160232		05109 7365	Privat		Aktiv	6	3-5, nicht Mo oder Di			Dagmar Hake (Mutter) 0511 27089191				
Fues Inge	Bernhard	2	Kopenhagener Straße 11, 30457 Hannover	Ricklingen	20.08.1942	Barmer 	Y569015711	-	0511 432701	Kasse 	Ja	Aktiv	3	(3),4,5, nicht Do, Di nur 5, am liebsten Mi			Christina Fues 0172 2999149				
Nötzel Marina	Bernhard	1	Geveker Kamp 9, 30455 Hannover	Linden	14.09.1969	Techniker	A038537131		01512 2371679	Kasse 		Aktiv	6	Ab 10, Tag egal							
Erichsen Ursula	Meliha	1	Arnoldstraße 3, 30519 Hannover	Waldhausen	2/10/1943	Techniker	W141125282		0511 83 99 95	Kasse 		Aktiv	3	1, Mo-Fr							
Wieczorek Alwine	Meliha	2	Hitzackerweg 1a, 30625 Hannover	Groß-Buchholz	12/15/1939	KVB	-	Beantragt	0511 81 45 07	Privat		Aktiv	6	Mo,Mi,Fr 1 Di,Do 1-5							
Wieczorek Ruth	Nasja	2	Depenauer Ring 26, 31275 Lehrte	Lehrte	11/18/1932	Knappschaft	K413303461		0179 501 0054	Kasse 		Aktiv	6				Merforet Roswitha, Freundin 0513 998 4220				
Wolfgang Wappler	Theresa	3	Lange Feldstraße 115, 30926 Hannover	Seelze	1/23/1956	Barmer 	Z519940321	Beantragt	0511 7081 7738	Kasse 		Aktiv	6	Di, Mi			Michael Ernst (Betreuer) 0157 3452 4998				
Mehlkorn-Kramer Carola	Theresa	2	Rudolf-Harbig-Weg 8, 30827 Garbsen	Garbsen	8/12/1962	TKK	L618617671	-	0172 1598023	Kasse 		Aktiv	3	Di-Fr 1-5			Julia Kramer 0175 7747 010				
Kunkel Jonas	Theresa	1	Podbielskistraße 133, 30177 Hannover	List	8/9/1993	Audi BKK	Y751317093	-	0160 1640 907	Kasse 		Aktiv	6	Mo-Fr 2-5		Bis Januar wöchentlich	Bettina Kunkel (Mutter) 0178 1406 976				
Reher Margret	Alina	1	Ernststraße 11, 30559 Hannover	Kirchrode	3/18/1937	Barmer	I481468420		0511 520467	Kasse		Aktiv	3	Flexibel, gerne Vormittags			Jan Schneidereit (Enkel), 0163 2495218				
Jablonski Beate	Bernhard	3	Weiße Rose 24, 30459 Hannover	Ricklingen	10/11/1942	AOK Niedersachsen	M624162027	-	0511 433515	Kasse		Aktiv	3	Ab 9, Tag egal			Grazyna Bode (Tochter) 0157 52288660				
Jablonski Richard	Bernhard	2	Weiße Rose 24, 30459 Hannover	Ricklingen	3/5/1942	BKK exklusiv	G360834581	-	0511 433515	Kasse		Aktiv	3				Grazyna Bode (Tochter) 0157 52288660				
Bondar Eddie	Alina	2	Rotekreuzstraße 11, 30627 Hannover	Groß-Buchholz	11/8/2015	AOK Niedersachsen	P849495324	Beantragt	0159 0612 3057	Kasse		Aktiv	6	Mi-Fr 1-5							
Linck Thurid	Ilka	2	Gartenheimstraße 47A, 306659 Hannover	Bothfeld	9/11/1945	DAK-Gesundheit	B926944877	-	0511 6477087	Kasse		Aktiv	3	Zwischen 12-15, nicht Do							
Lodiga Jürgen	Ilka	2	Gartenheimstraße 47A, 306659 Hannover	Bothfeld	10/27/1947	DAK-Gesundheit	E745771082	-	0511 6477087	Kasse		Aktiv	3								
Duijnisveld Felicitas	SIska	1	Allerweg 10, 30449 Hannover	Linden	2/4/1957	Barmer	W933267482		0511 2158467	Kasse		Aktiv	3	Ab 14, nicht Mo/Mi			Michael Opertz, 0160 90854527				
Zsussa Dina	Theresa	1	Moorhoffstraße 35, 30419 Hannover	Stöcken	6/3/1967	AOK Niedersachsen	B072734130		0176 5796 6480	Kasse 		Aktiv	3	Mo, Mi-Fr 1-5			Martina Trepczyk, 0176 4636 9097				
Kroll Reinhard	Sabine	1	Hildesheimer Str 370 ,30880 Laatzen	Laatzen	5/14/1950	Hanse Merkur	-	-	0177 5141 950	Privat		Aktiv	3	Mo-Fr 2-5		Bis April wöchentlich					
Wilkening Bärbel	Sabine	3	Marktplatz 7, 30880 Laatzen	Laatzen	4/19/1937	DAK-Gesundheit	A525153973	Beantragt	0511 82 71 93	Kasse 		Aktiv	6	Mo-Fr 1-3		Ab Oktober erst	Kerstin Lürsen (Tochter) 0174 9692 825				
Grimsmann Dieter	Theresa	1	Am Listholze 4, 30177 Hannover	List	12/23/1952	AOK Niedersachsen	K105980929		0511 85 38 64	Kasse 		Aktiv	6	Mo-Fr 1-5		Bis Anfang März wöchentlich					
Bode Franz-Dieter	Salinger	2	Findstellenweg 17, 30629 Hannover	Misburg	10/4/1948	DAK-Gesundheit	B985914698	Beantragt	0511 58 12 69	Kasse 		Aktiv	6	Mo-Fr 3-5							
Köhler Lydia	-	2	Bartold-Knaust-Str. 39, 30459 Hannover	Ricklingen	6/18/1939	AOK Niedersachsen	W332425341	Beantragt	0157 38981077	Kasse		Aktiv	0				Uwe Köhler 0177 4246828				
König Paul	Ilka	2	Edderweg 11a, 30855 Langenhagen	Langenhagen	3/20/1936	DAK-Gesundheit	Y806396637	Beantragt	0511 736067	Kasse		Aktiv	12	Di 1+2			Silke König 0151 18328683				
Ihsen-Lukas Margit	Sabine	2	Lange Weihe 101c, 30880 Laatzen	Laatzen	2/7/1944	KKH	C303069221	Beantragt	0511 4449 7379	Kasse 		Aktiv	6	Mo-Fr 3-5			Gernhold Ihsen-Lukas (Mann) 0152 3809 4784				
Hopfe Gabriele	Bernhard	2	Rothenfelder Str 14, 30455 Hannover	Badenstedt	8/27/1965	AOK Niedersachsen	I944330605	Beantragt	0179 5341 590	Kasse 		Aktiv	12	Mo,Mi,Fr 1-5							
Berger Erika	Sabine	1	Kreuzweg 6, 30880 Laatzen	Laatzen	12/2/1938	Barmer 	O260744749		0511 87 15 40	Kasse 		Aktiv	3	Mo-Fr 2-5			Christine Rose (Tochter) 0176 3038 6704				
Murthy Marianne	Theresa	3	Bödekerstraße 48, 30161 Hannover	List	1/25/1937	Techniker	U473457055	Beantragt	0511 59 10 39 28	Kasse 		Aktiv	18	Mo-Fr 3,4, gerne 4, gerne nicht Mi			Gita Murthy 0170 4877 358, Janin von Eye 0157 8066 4137				
Streitbürger Beate	Theresa	3	Am Listholze 29C, 30177 Hannover 	List	11/18/1961	DAK-Gesundheit	M089541505	Fehlt noch	0511 36732745 / 0170 1120722	Kasse		Aktiv	6	Di-Fr ab 12			Nadine Streitbürger (Tochter) 0171 2100010				
Neiber Jörg	Nasja	1	Birkenweg 2, 31319 Sehnde	Sehnde	7/5/1947	Techniker	R453480901		05138 9122 / 0176 80832424	Kasse		Aktiv	3	Nicht 1			Renate Neiber (Frau) / Marco Neiber (Sohn) 0174 9761446				
Wittkugel Ilse	Theresa	2	Göbelstraße 22, 30163 Hannover 	List	2/8/1948	AOK Niedersachsen	H696949721	Nächstes Jahr	0511 634833	Kasse		Aktiv	6	Mi-Fr flexibel, am liebsten Do			Carsten Wittkugel 0172 182319 / Jörg Wittkugel 0511 3749873 (Söhne)				
Neuhaus Heidemarie	Ilka	1	Reiherweg 5, 30916 Isernhagen	Altwarmbüchen	6/7/1941	Continetale BKK	R886177130		0176 40436147	Kasse		Aktiv	0				Uwe Neuhaus (Ehemann), 0511 619920				
Tschunkert Magdalene	Bernhard	2	Am Haselbusch 31, 30459 Hannover	Ricklingen	1/6/1934	AOK Niedersachsen	K409441531	Beantragt	0511 2345744	Kasse		Aktiv	6	Di und Do nur 1,2, sonst flexibel, lieber 1,2			Monika Nehmann 0173 8067450				
Kusch Volker	Theresa	-	Am Langen Kampe 9, 30655 Hannover 	List	7/27/1981	Techniker	V695247427		0174 9776183	Verordnung		Aktiv	6	Flexibel		Ärztliche Verordnung bis 16.09. mit Option auf 2 weitere Wochen					
Hasch Renate		2	Hohensteinweg 10, 30419 Hannover	Stöcken	2/24/1944	Barmer 	Y131780345	-	0511 97948	Kasse 		Aktiv	3	Mo,Di,Do,Fr 2-5							
Langhans Thomas		3	Schleiermacherstraße 1, 30625 Hannover	Kleefeld	1/4/1960	Barmer 	R201796769	-	0172 4285 822	Kasse 		Aktiv	6	Di 10:30		Belgeitung zur Physio ab Oktober 24		Aug-25			
Wallmann-Schlossmann Ulrike	Sabine	1	Curiehof 15, 30627 Hannover	Groß-Buchholz	12/18/1940	Techniker	L443837056		0511 54 90 446	Kasse 		Aktiv	6	Quasi immer		Bis April 26 wöchentlich		Aug-25			
Siebert Werner		2	Lehrchenfeldstraße 31, 30539 Hannover	Mittelfeld	6/24/1953	HEK	G891081268	Beantragt	0511 86 19 49	Kasse 		Aktiv	6	Mo-Mi,Fr 2-5		Alle 14 tage 3		Aug-25			
Beyer Monika	Ilka	1	Weserweg 18, 30851 Langenhagen	Langenhagen	11/3/1943	AOK Niedersachsen	F277320652		0511 63 58 47	Kasse		Aktiv	3	Mo-Fr 1-5			Claudia Kammel 0175 5456 692	Aug-25			
Ritter Holger		2	Am Seelberg 44, 30629 Hannover	Misburg	1/12/1957	DKV		Beantragt	0511 58 64 02	Privat		Aktiv	6	Mo-Fr 2-3				Aug-25			
Erichsen Freerk	Meliha	1	Arnoldstr 3, 30519 Hannover	Waldhausen	1/19/1940	Techniker	Z494474575			Kasse 		Aktiv	3								
Seitz Evelin	Meliha	1	Neckarstraße 9, 30519 Hannover	Döhren-Jammer	5/19/1947	DKV	KV328181466	Beantragt	0511 83 87 207	Privat		Aktiv	6	Muss Florian wissen							
Burow Jutta-Maria		1	Bessemerstr 19, 30177 Hannover	List	12/29/1943	DAK-Gesundheit	D424661037		0511 66 46 86	Kasse 		Aktiv	3	Mo-Fr 1,2			Inis Huber, 0175 6593 606				
Sasse Rita		2	Apenrader Straße 55, 30165 Hannover	Vahrenwald	7/11/1956	Techniker	Q217729698	-	0172 17 00 403	Kasse 		Aktiv	6	Mo-Fr 1-5							
Olas										Kasse 		Aktiv									
Rode Claudia	Ilka	1	Bissendorfer Weg 7, 30855 Langenhagen	Langenhagen	11/13/1954	Barmer	L220569565		0178 6094889	Kasse		Aktiv	3				Nicole Hanke-Nowitz (Tochter), 0177 8933722				
Perschel Christa	Theresa	2	Gustav-Adolf-Straße 7, 30167 Hannover	Nordstadt	4/10/1936	Barmer	Q192099499	-	0511 702479	Kasse		Aktiv	3	Nicht Mi, ab 10			Dirk Perschel (Sohn) 05108 1741 / 01737121304				
Perschel Bruno	Theresa	1	Gustav-Adolf-Straße 7, 30167 Hannover	Nordstadt	8/30/1934	Barmer	U3030445207		0511 702479	Kasse		Aktiv	3	Nicht Mi, ab 10			Dirk Perschel (Sohn) 05108 1741 / 01737121304				
Hagenbach Elfriede	Lisa	1	Grindelhof 4, 30459 Hannover	Ricklingen	5/8/1933	Pronova BKK	A995971751		0511 411033	Kasse		Aktiv	3	Nicht Di, nicht Do nach 12, nicht Mittags		Möchte Frau	Klaus-Dieter Hagenbach (Sohn) 0176 84423599				
Ackermann-Werner Petra		1	Troskeweg 1, 30419 Hannover	Herrenhausen	9/11/1951	LKH	928224		0511 21591103	Privat		Aktiv	3	Am besten Mo oder Fr ab 11			Benedikt Werner, 0179 9437118				
Benter Petra	Ilka	1	Walsroder Str. 111C, 30853 Langenhagen	Langenhagen	8/1/1957	AOK Niedersachsen	H608446766		0511 21943238	Kasse		Aktiv	3	Ab 10, nicht Nachmittags, am liebsten Do/Fr			Nadine Benter (Tochter), 0179 4330941				
Schönemann Angelika	Theresa	2	Bronsartstraße 19, 30161 Hannover	Nordstadt	5/7/1960	Barmer	A611623166	-	0511 37034611	Kasse		Aktiv	6	Ab 10, lieber Vormittags			Mareike Schönemann (Tochter), 0176 55016200				
Grimke Hanspeter			Osterholzweg 11, 30952 Ronnenberg	Benthe	8/6/1938	Continentale	5265572		05108 3530	Privat		Aktiv	0	Nur Do, ab 11, am liebsten um 12			Jens Grimke (Sohn) 0172 5477657				
Grimke Marika		2	Osterholzweg 11, 30952 Ronnenberg	Benthe	2/4/1940	Continentale 			05108 3530	Privat + Beihilfe		Aktiv	6	Nur Do, ab 11, am liebsten um 12							
Ilsemann Albert-Otto		4	Kastanienallee 10, 30851 Langenhagen	Langenhagen	7/6/1939	SBK Niedersachsen	W065825398	Fehlt noch	0176 21734239 (Ehefrau)	Kasse	Ja	Aktiv	0	Nur Arztbegleitung			Aytunc Azapoglu (Schwiegersohn, breiter als der Türsteher, Kopie LW an ihn), 0176 63840936, aytunc.a@web.de				
Bliem Sabine	Bernhard	2	Pfarrsraße 31A, 30459 Hannover	Ricklingen	7/23/1963	KKH	X040009654	Beantragt	0179 6977456	Kasse		Aktiv	12	Nach der Reha neu besprechen			Sandra Altstädter, 01577 1075794				
Von Kolkow Michael	Ilka	1	Narzissenstraße 6, 30853 Langenhagen	Langenhagen	11/29/1962	Pronova BKK	H031686440		0176 92465261	Kasse		Aktiv	3	Mi-Fr, ab 12			Dietmar Krzemien 0511 736151				
Sänger Uwe	Theresa	2	Husarenstraße 12, 30163 Hannover	List	10/20/1950	DAK-Gesundheit	X287233515	Nächstes Jahr	0511 96928010	Kasse	Ja	Aktiv	6	Nur 2, am liebsten Mi, sonst Di oder Fr			Antje Brinkmann (Frau), 0176 52562113				
Kießig Jörn		3	Klaus Groth Str 11, 30655 Hannover	List	10/14/1969	Viactiv		-	01578 4900 708	Kasse 		Aktiv	3								
Holzky Brigitte	Nasja	1	Zuckerfabrikweg 4, 31319 Sehnde	Sehnde	6/30/1940		I891257138		05138 61 69 76	Kasse 		Aktiv	3				Conni Klusmann, 0163 2764250				
Stein Laurin	Nasja	2	Hartenbrakenstraße 15a, 30659 Hannover	Bothfeld	4/17/2007	BKK Freudenberg	412438703	-	0176 62564787	Kasse		Aktiv	3	Di, Fr, lieber Vormittags							
Fink Horst-Dieter	Lisa	2	Kaliweg 20, 30952 Ronnenberg	Benthe	5/11/1945	Techniker	H625584605		05109 9567	Kasse		Aktiv	6	Mo-Fr 5							
Hellwig Ingeborg		2	Bahnhofstr 1, 30853 Langenhagen	Langenhagen	7/26/1937	Techniker	B452354113		0511 735441	Kasse		Aktiv	3	Mo-Fr 3-5			Ralph Wedekind, 07641 9539342				
Günther Johanna	Sabine	2	Bismarckstraße 6, 31319 Sehnde	Sehnde	7/20/1947	Knappschaft	150013282		05138 3520	Kasse		Aktiv	3	Mi,Do 2,3			Julia Günther (Tochter), 0172 6209055				
Karin Pinther	Lisa	2	Hudeplan 16, 30453 Hannover	Limmer	7/4/1944	BKK ProVita	A736964319		0511 468316	Kasse		Aktiv	6	Di,Mi,Fr 2-5			Gabriele Klose, 0177 7538099				
Troll Ilse	Mascha	1	Hartenbrakenstraße 23A, 30659 Hannover	Bothfeld	11/26/1933	PBK Privat			0511 652208	Privat + Beihilfe		Aktiv	3			Ilse.troll@web.de	Barbara Troll (Tochter), 0175 4131970				
Troll Monika	Mascha	2	Hartenbrakenstraße 23A, 30659 Hannover	Bothfeld	1/1/1965	PBK Privat			0511 652208	Privat + Beihilfe		Aktiv	3				Barbara Troll (Schwester), 0175 4131970				
Kinzel Rosa	Theresa	2	Apenrader Str. 55, 30165 Hannover 	Vahrenwald	7/29/1937	GPV (Privat)	3300092322		015111 67693750 ?	Privat		Aktiv	6				Kinzel Rosweitha, 0511 67654776				
Nölcke Susanne	Lisa	3	Am Grünen Hagen 78, 30459 Hannover	Ricklingen	5/28/1962	KKH	S027913995	-	0157 80366162	Kasse		Aktiv	6	Ab 11, ungerne Nachmittags, nicht Fr			Denise Bremer (Tochter), 0157 71116455				
Slopianka Ursel		1	Heinrich-Heine-Ring 26, 30629 Hannover	Misburg	10/4/1945	Techniker	U854415388		0511 37366976	Kasse		Aktiv	3	Zwischen 10-14, nicht Fr			Marion Braun (Tochter), 01516 5648781				
Sellnau Melanie		4	Ada-Lessing-Straße 103, 30657 Hannover	Bothfeld	5/7/1960	Techniker	J073028527	-	0176 22050385	Kasse		Aktiv	6	Mi oder Fr Nachmittags		Mitarbeiter muss Corona Impfung haben	Martin Sellnau, 0177 7748837				
Murtfeld Holger	Theresa	1	Husarenstraße 7, 30163 Hannover	List	1/12/1967	KKH	X038765665		0174 4783837	Kasse		Aktiv	3	Ab 10, Tag egal			Lena Gagemann (Betreuerin), 0152 53018565				
Schöne von Zweydorff Barbara		3	Von-Alten-Allee 19, 30449 Hannover	Linden	3/7/1940	AOK Niedersachsen	H479856582	-	0511 37397586	Kasse		Aktiv	6	Ab 10, Tag egal			Rolf Schöne (Ehemann)				
Hilgerloh Ralf	Lisa	2	Sandsteinweg 23, 30455 Hannover	Davenstedt	8/3/1939	Continentale Privat			0511 497462	Privat + Beihilfe		Aktiv	6	Mi 1-5 gerne Vormittags		bis ende april wöchentlich					
Below Helga	Bernhard	1	Martinihof 22, 30455 Hannover	Davenstedt	7/27/1941	Techniker	S372961817		0511 495815	Kasse 		Aktiv	3	4,5 Nachmitags 			Margot Bantelmann, 05108 4494				
Büchner Monika 		2	Bussestraße 11, 30655 Hannover	Buchholz-Kleefeld	7/1/1954	BKK Pronova	P443281205		0176 58871718	Kasse 		Aktiv	6	Mi/Do, 1-5 bevorzugt Morgens 		ne nette	Reinhard Kroll (Freund), 0177 5141950				
Maehle Katrin		1	Buchnerstr 15, 30627 Hannover	Buchholz	12/24/1957	Techniker	U225594458		0177 6895 938	Kasse 		Aktiv	3	Mo-Fr 2-5							
Schmidt Bettina		1	Osterfelddamm 83, 30627 Hannover	Buchholz	12/14/1959	DAK-Gesundheit	L925144779		0511 2100 079	Kasse 		Aktiv	3	Mo-Fr 1-5							
Wojtucki Bruno		2	Ohebruchstr 2A, 30419 Hannover	Stöcken	12/9/1948	KKH	K890454191		0511 22 86 995	Kasse 		Aktiv	3	Mo-Fr 1-5							
Behrmann Gisela	Theresa	1	Brahmsstraße 3, 30177  Hannover	List	12/9/1943	KKH	Z929201066		0176 3011 4603	Kasse 		Aktiv	3								
Heuer Evelin		1	Ludwig-Sievers Ring 42, 30659 Hannover	Bothfeld	6/30/1948	Techniker	O778269987		0511 64 90 040	Kasse 		Aktiv	6	Mo, Do, Fr nachmittags	Alle 14 tage 3						
Rosenowski Iris	Lisa	1	Rohlfsstraße 4, 30455 Hannover	Davenstedt	5/20/1957	Techniker	V261970768		0176 2278 1187	Kasse 		Aktiv	3	Immer							
Wüstefeld Brigitte	Lisa	2	Droehnenstraße 35e, 30455 Hannover	Badenstedt	6/12/1951	DAK-Gesundheit	D168969358		0511 49 87 05	Kasse 		Aktiv 	3	Mo-Mi 2-5							
Rosenkranz Elke		1	Bussestraße 38, 30655 Hannover	Buchholz	7/7/1941	DAK-Gesundheit	Z417406315		0511 5479155	Kasse		Aktiv	3	Mo-Do, ab 11, nicht ganz spät			Andreas Rosenkranz (Sohn), 015231873722				
Trips Irmgard		1	Freienwalder Straße 18, 30629 Hannover	Misburg	8/14/1935	Techniker	F698181782		0511 582966	Kasse		Aktiv	6	Do, Fr 1,2			Trips Hans Günter (Ehemann) 0160 5122868				
Weber Elisabeth	Ilka	2	Veilchenstraße 19, 30853 Langenhagen	Langenhagen	9/26/1938	BKK VBU	K834088982		0176 61782209	Kasse		Aktiv	3	Mi-Fr, ab 10, lieber Vormittags			Benita Weber (Tochter), 015203000961				
Jaguttis Antje		2	Sachsenhof 8, 30179 Hannover	Bothfeld 	6/7/1940	Mobil	V233597519	Nächstes Jahr	0511 6044532	Kasse		Aktiv	6	Ab 10, Tag egal			Karl Strasdas (Sohn, wohnt mit in der Wohnung)				
Suerburg Elke	Ilka	2	Fichtenstraße 3b, 30855 Langenhagen	Schulenburg	8/12/1942	Mobil	Q511935678	Beantragt	0511 784573	Kasse		Aktiv	6	Mo-Mi 1,2			Carsten Suerburg (Ehemann)				
Schulze Irmgard	Lisa	1	Alte Aue 47, 30962 Seelze	Letter	7/18/1946	KVB	33000027486		0511 406756	Privat		Aktiv	3	Ab 10, nicht Mi oder Fr							
Berg Regina	Ilka	2	Pressburger Straße 1, 30900 Wedemark	Wedemark	3/11/1961	DAK-Gesundheit	M603539922		05130 36729	Kasse		Aktiv	3	Di, Do, Zeit egal			Caroline Berg (Tochter), 0176 22176840				
Timm Holger		2	Schieferkamp 37, 30455 Hannover	Davenstedt	8/20/1952	GPV (Privat)	33000029052	-	0511 404535	Privat		Aktiv	6	Ab 11, am liebsten Do			Monika Grellmann-Timm (Ehefrau)				
Tochtenhagen Silvia	Ilka	1	Dorfstraße 58, 30855 Langenhagen	Schulenburg	4/9/1955	AOK Niedersachsen	V148420748		0171 9030602	Kasse		Aktiv	3	Do, Fr, nicht Mittags			Tochtenhagen Reinhard (Ehemann) 0511 741327				
Engel Isabella	Ilka	1	Schäferweg 10, 30855 Langenhagen	Schulenburg	4/27/1975	BKK Firmus	A081170252		0173 6161794	Kasse		Aktiv	6	Fr Vormittags, Mo, Di auch ok							
Witzendorf Doris		2	Schildhof 3, 30835 Langenhagen	Langenhagen	10/14/1942	Techniker	Y989923373		0511 4953 0189	Kasse 		Aktiv 									
Scheel Renate		3	Mansfeldstr 18, 30459 Hannover	Ricklingen	3/21/1941	Barmer	H777876965	Beantragt	0172 5141 341	Kasse 		Aktiv 	6								
Scheel Eckard		3	Mansfeldstr 18, 30459 Hannover	Ricklingen	9/18/1938	Barmer	Z074293914	Beantragt	0173 5141 341	Kasse 		Aktiv 	6								
Müller Burkhard		2	Rose-Senger-Straße 54, 30627 Hannover	Buchholz	11/21/1938	BARMER	E976322890	Beantragt	0179 260 3455	Kasse 		Aktiv 	6	Mo-Fr 2-3							
Becker Lillith		2	Burgdorfer Damm 75, 30625 Hannover	Heideviertel	8/28/2023	AOK Niedersachsen	M655994486	Beantragt	0151 5078 8561	Kasse 		Aktiv 	6	Mo-Fr 1,2							
Kinitz Marion		2	Innerste Weg 6, 30419 Hannover	Ledeburg	10/23/1943	mobil	A139986135	Beantragt	0511 85 59 95	Kasse 		Aktiv 	6	Mo-Fr 3-5							
Schwobe Patricia		1	Peiner Str 52, 30519 Hannover	Südstadt	11/20/1970	DAK-Gesundheit	O078010234		0157 3444 7594	Kasse 		Aktiv 	3	Mo 1,2 Di 2-5 Mi 1-3 Do&Fr 1-5							
Scharfenberg		2	Peiner Str 37, 30519 Hannover	Südstadt	7/19/2011	BKK exklusiv	G598012521		0152 0366 0915	Kasse 		Aktiv 	3	Di,Do 1-3							
Lücke Brunhild	Ilka	2	Benskamp 30, 30855 langenhagen	Langenhagen	10/25/1938	AOK Niedersachsen	L067703576	Ja	0511 77 11 44	Kasse 		Aktiv 	6	Mo 1 Di-Fr 1,2,5							
Lachmann Bettina		1	Dorfstraße 11, 30982 Reden	Reden	2/1/1996	KKH	W557140686		0175 28 75 766	Kasse 		Aktiv 	3	Di, Do vormittag nicht							
Klatt Annegret		2	Nordstr 18, 31319 Sehnde	Sehnde	9/6/1949	BKK Energie	N842767888	Ja	05138 7097414	Kasse 		Aktiv 	6	Mo,Di,Mi,Fr 3-5			Marco Klatt 0173 7102837				
Wohlgemuth Astrid		3	Reutergartenweg 37, 31319 Sehnde	Sehnde	5/13/1940	BARMER	K068205670	Nächstes Jahr	05132 66 10	Kasse 		Aktiv 	6	Mo,Mi,Fr 2-5							
Rattay Simone		2	Rote Reihe 15, 30827 Garbsen	Garbsen	3/15/1965	BARMER	L613197091	Beantragt	05131 94474	Kasse 		Aktiv 	6	Mo 1-3, Di,Mi 3-5 , Do 1-3							
Becker Lilith		2	Burgdorfer Damm 75, 30625 Hannover	Heideviertel	8/28/2023	AOK Niedersachsen	M655994486	Beantragt	0151 5078 8561	Kasse 		Aktiv 	6	Mo-Fr 1,2							
Becker-Wewestaedt Heidrun		2	Plengestr 3, 30459 Hannover	Ricklingen	10/1/1950	Debeka			0511 4228 90	Privat		Aktiv	`;

export const importAllCustomers = async () => {
  try {
    console.log('Starting customer import...');
    
    // First, delete all existing customers
    const { error: deleteError } = await supabase
      .from('kunden')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Error deleting existing customers:', deleteError);
      throw deleteError;
    }
    
    console.log('Existing customers deleted');

    // Parse the customer data
    const customers = parseCustomerData(customerData);
    console.log(`Parsed ${customers.length} customers`);

    // Import customers in batches to avoid timeout
    const batchSize = 50;
    let totalSuccess = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      console.log(`Importing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(customers.length / batchSize)}`);
      
      for (const customer of batch) {
        try {
          const { error } = await supabase
            .from('kunden')
            .insert(customer);
            
          if (error) {
            allErrors.push(`Fehler bei ${customer.vorname} ${customer.nachname}: ${error.message}`);
          } else {
            totalSuccess++;
          }
        } catch (err) {
          allErrors.push(`Unerwarteter Fehler bei ${customer.vorname} ${customer.nachname}: ${err}`);
        }
      }
    }

    console.log(`Import completed: ${totalSuccess} successful, ${allErrors.length} errors`);
    return { success: totalSuccess, errors: allErrors };
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
};