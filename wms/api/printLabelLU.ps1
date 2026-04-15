<##
    Print a label for a Warehouse Loading Unit (LU) using ZPL to a network printer.

    DESCRIPTION:
        This script queries the database for information about a given LU and the associated printer for a user, builds a ZPL label, and sends it to the printer over TCP/IP.

    USAGE:
        powershell -File .\printLabelLU.ps1 -LU <LU_NUMBER> [-idUser <USER_ID>]
        Example:
            powershell -File .\printLabelLU.ps1 -LU 123456789 -idUser 42
            # Prints a label for LU 123456789 using the printer configured for user 42.
##>
param(
    [Parameter(Mandatory=$true)]
    [int]$LU,
    [int]$idUser = -5
)

# 1. Query database for LU and printer info (replace with your connection details)
$connectionString = "Server=VMWEB;Database=DataDELCO;Integrated Security=True;"
$query = @"
SELECT 
    LU.fPartNumber, LU.fDescription, LU.fLU, LU.fBatch, LU.fOrigin,
    JSON_VALUE(S.fData, '$.ip') AS PrinterIP,
    JSON_VALUE(S.fData, '$.port') AS PrinterPort
FROM wms.vWarehouseLU LU
JOIN wms.tWarehouseSettings S ON S.fPath = 'global/printers/warehouse' AND JSON_VALUE(S.fData, '$.iduser') = $idUser
WHERE LU.fLU = $LU
"@

$result = Invoke-Sqlcmd -Query $query -ConnectionString $connectionString

$nullOrEmpty = $null -eq $result -or ($result -is [System.Array] -and $result.Count -eq 0)
if ($nullOrEmpty) {
    Write-Host "No result found. Exiting script."
    exit
}

# 2. Build ZPL string (readable, SQL logic fidelity)
$desc = $result.fDescription
$desc1 = if ($desc.Length -ge 1) { $desc.Substring(0, [Math]::Min(45, $desc.Length)) } else { "" }
$desc2 = if ($desc.Length -gt 45) { $desc.Substring(45, [Math]::Min(45, $desc.Length-45)) } else { "" }
$desc3 = if ($desc.Length -gt 90) { $desc.Substring(90, [Math]::Min(45, $desc.Length-90)) } else { "" }

# Format LU as 9-digit string
$luStr = "{0:D9}" -f [int]$result.fLU

# Build optional batch/origin line
$batchOrigin = ""
if ($result.fBatch -and $result.fOrigin) {
    $batchOrigin = "Data code: $($result.fBatch) Origin: $($result.fOrigin)"
} elseif ($result.fBatch) {
    $batchOrigin = "Data code: $($result.fBatch)"
} elseif ($result.fOrigin) {
    $batchOrigin = "Origin: $($result.fOrigin)"
}

# Build ZPL using a here-string and embedded expressions for clarity and minimal concatenation
$zpl = @"
^XA
^PW799 ; 10 cm × 203 dpi / 2.54
^LL400 ; 5 cm × 203 dpi / 2.54
^CF0,50
^FO25,50^FD$($result.fPartNumber)^FS
^CF0,30
$(if ($desc1) {"^FO25,105^FD$desc1^FS"})
$(if ($desc2) {"^FO25,135^FD$desc2^FS"})
$(if ($desc3) {"^FO25,165^FD$desc3^FS"})
^CF0,120,70
^FO25,215^FD$luStr^FS
^BY4,2,270
^FO360,215^BC,100,N,N,N,A^FD$luStr^FS
^CF0,30
$(if ($batchOrigin) {"^FO25,340^FD$batchOrigin^FS"})
^XZ
"@

# 3. Send ZPL to printer
$client = New-Object Net.Sockets.TcpClient($result.PrinterIP, $result.PrinterPort)
$stream = $client.GetStream()
$bytes = [Text.Encoding]::ASCII.GetBytes($zpl)
$stream.Write($bytes, 0, $bytes.Length)
$stream.Close()
$client.Close()
