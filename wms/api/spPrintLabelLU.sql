USE [DataDELCO]
GO
/****** Object:  StoredProcedure [wms].[spPrintLabelLU]    Script Date: 12/04/2026 08:05:39 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		Giancarlo Trevisan
-- Create date: 2023/01/18
-- Description:	Sent LU label to ZEBRA via ZPL
-- Usage:		exec wms.spPrintLabelLU 32974, 423
-- =============================================
ALTER     PROCEDURE [wms].[spPrintLabelLU](@LU int, @idUser int = null)
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @DELTA_MIN decimal(18,6) = 1000, @CR char(1) = CHAR(10);
	DECLARE @codice char(10);
	DECLARE @delta decimal(18,6) = isnull(cast(DATEDIFF_BIG(MILLISECOND, '2020-01-01', GETDATE()) as decimal(18,6)) - (SELECT fValue FROM wms.tWarehouseSettings WHERE fPath = 'global/printers/warehouse' and JSON_VALUE(fData, '$.iduser') = @idUser), 10 * @DELTA_MIN);

	IF @delta is not null and @delta > @DELTA_MIN BEGIN -- Non consentire stampe ravvicinate più di @DELTA_MIN millisecondi
		DECLARE @ZEBRA_IP varchar(15), @ZEBRA_PORT int;
		SELECT @ZEBRA_IP = JSON_VALUE(fData, '$.ip'), @ZEBRA_PORT = JSON_VALUE(fData, '$.port')
			FROM wms.tWarehouseSettings WHERE fPath = 'global/printers/warehouse' and JSON_VALUE(fData, '$.iduser') = @idUser;
--		PRINT concat(@ZEBRA_IP, ':', @ZEBRA_PORT);

		DECLARE @zpl varchar(8000) = replace((
			SELECT 
				concat(
					'^XA',
					'^PW799',	-- 10 cm × 203 dpi / 2.54
					'^LL400',   -- 5 cm × 203 dpi / 2.54
					'^CF0,50',
					'^FO25,50^FD', LU.fPartNumber, '^FS',
					'^CF0,30',
					'^FO25,105^FD', substring(LU.fDescription, 1, 45), '^FS',
					'^FO25,135^FD', substring(LU.fDescription, 46, 45), '^FS',
					'^FO25,165^FD', substring(LU.fDescription, 91, 45), '^FS',
					'^CF0,120,70',
					'^FO25,215^FD', FORMAT(LU.fLU, '000000000'), '^FS',
					'^BY4,2,270',
					'^FO360,215^BC,100,N,N,N,A^FD', FORMAT(LU.fLU, '000000000'), '^FS',
					'^CF0,30',
					'^FO25,340^FD', 'Data code: ' + LU.fBatch, ' Origin: ' + LU.fOrigin, '^FS',
					'^XZ'
				)
			FROM 
				wms.vWarehouseLU LU
			WHERE 
				LU.fLU = @LU
		), @CR, ' ');

		DECLARE @cmd varchar(8000);
		SET @cmd = concat('powershell -command @''', @CR,
			'$zpl=''', REPLACE(@zpl,'''',''''''), ''';',
			'$c=New-Object Net.Sockets.TcpClient(''', @ZEBRA_IP, ''',', @ZEBRA_PORT, ');',
			'$s=$c.GetStream();',
			'$b=[Text.Encoding]::ASCII.GetBytes($zpl);',
			'$s.Write($b,0,$b.Length);',
			'$s.Close();',
			'$c.Close();', @CR,
			'''@', @CR);
--		PRINT @cmd;
		EXEC xp_cmdshell @cmd;

		-- Registra timestamp di stampa
		UPDATE wms.tWarehouseSettings SET fValue = DATEDIFF_BIG(MILLISECOND, '2020-01-01', GETDATE()) WHERE fPath = 'global/printers/warehouse' and JSON_VALUE(fData, '$.iduser') = @idUser;
	END
END
/*
http://labelary.com/viewer.html
https://stackoverflow.com/questions/44575549/zebra-printer-wont-print-zpl-format

^XA
^PW799    ; 10 cm × 203 dpi / 2.54
^LL400    ; 5 cm × 203 dpi / 2.54
^CF0,50
^FO25,50^FDEMLED10/160 2500^FS
^CF0,30
^FO25,110^FDEMERGENCY LIGHT KIT^FS
^CF0,120,70
^FO25,200^FD000000001^FS
^BY4,2,270
^FO360,200^BC,100,N,N,N,A^FD000000001^FS
^CF0,30
^FO25,330^FDA01 001 01^FS
^XZ
*/

/*
^XA
^PW799
^LL400
^CF0,18^FO20,20^FDDescription:^FS
^CF0,18^FO140,20^FDPACCO BATT. NI-MH SC 6.0V 3000mAH 220MM CAVO^FS
^CF0,18^FO20,45^FDClient:^FS
^CF0,22^FO20,65^FDG.E.K. S.R.L.^FS
^BY1,2,90^FO20,85^BC,50,N,N,N,A^FDG.E.K. S.R.L.^FS
^CF0,18^FO400,45^FDClient PN:^FS
^CF0,22^FO400,65^FDW061.1-5SC3000 HISUN^FS
^BY1,2,90^FO400,85^BC,50,N,N,N,A^FDW061.1-5SC3000 HISUN^FS
^CF0,18^FO20,145^FDManufacturer PN:^FS
^CF0,22^FO20,165^FDW064.1-5SC3000 HISUN^FS
^BY1,2,90^FO20,185^BC,50,N,N,N,A^FDW064.1-5SC3000 HISUN^FS
^CF0,18^FO450,145^FDOrder N:^FS
^CF0,22^FO450,165^FDOR/001083^FS
^BY1,2,90^FO450,185^BC,50,N,N,N,A^FDOR/001083^FS
^CF0,18^FO650,145^FDQuantity:^FS
^CF0,22^FO650,165^FD4^FS
^BY1,2,90^FO650,185^BC,50,N,N,N,A^FD4^FS
^CF0,18^FO20,245^FDConservation:^FS
^CF0,22^FO20,265^FDNOT DEFINED^FS
^BY1,2,90^FO20,285^BC,50,N,N,N,A^FDNOT DEFINED^FS
^CF0,18^FO300,245^FDCertification:^FS
^CF0,22^FO300,265^FDNOT DEFINED^FS
^BY1,2,90^FO300,285^BC,50,N,N,N,A^FDNOT DEFINED^FS
^CF0,18^FO575,245^FDBatch/Origin:^FS
^CF0,22^FO575,265^FD-^FS
^BY1,2,90^FO575,285^BC,50,N,N,N,A^FD-^FS
^CF0,16^FO20,345^FDMission:^FS
^CF0,16^FO300,345^FDLU:^FS
^CF0,16^FO775,345,1^FD31/03/2026^FS
^FO0,365^GB812,40,40,B,0^FS
^FO20,377^A0N,15^FR^FDDELCO SISTEMI srl^FS
^FO770,377,1^A0N,15^FR^FDdelco.it^FS
^XZ
*/