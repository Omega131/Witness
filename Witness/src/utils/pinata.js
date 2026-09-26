export async function uploadToPinata(encryptedBlob, pinataJwt) {
    if (!pinataJwt) {
        throw new Error("Pinata JWT is required for upload.");
    }

    const formData = new FormData();
    formData.append("file", encryptedBlob, "evidence.enc");

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${pinataJwt}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Pinata upload failed: ${err}`);
    }

    const data = await res.json();
    return data.IpfsHash;
}
