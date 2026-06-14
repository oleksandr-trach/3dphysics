class Vertex {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    draw() {
        context.fillStyle = "#FFFFFF";
        context.fillRect(this.x, this.y, 4, 4);
    }
}

class Triangle {
    constructor(v1, v2, v3, normal) {
        this.vertices = [v1, v2, v3];
        this.normal = normal;
    }

    getAverageDepth(modelMatrix) {
        // Calculating triangle center by its local vertices
        let localCenterX = (this.vertices[0].x + this.vertices[1].x + this.vertices[2].x) / 3;
        let localCenterY = (this.vertices[0].y + this.vertices[1].y + this.vertices[2].y) / 3;
        let localCenterZ = (this.vertices[0].z + this.vertices[1].z + this.vertices[2].z) / 3;

        let localVec4 = vec4.fromValues(localCenterX, localCenterY, localCenterZ, 1);

        // Move triangle center to world coordinates
        vec4.transformMat4(tempDepthVec4, localVec4, modelMatrix);

        // Return world coordinate Z (how deep is triangle center in the scene)
        return tempDepthVec4[2];
    }

    draw(mvpMatrix, modelMatrix, cameraEye, lightDir) {
        mat3.fromMat4(tempNormalMatrix, modelMatrix);
        vec3.transformMat3(tempTransformedNormal, this.normal, tempNormalMatrix);
        vec3.normalize(tempTransformedNormal, tempTransformedNormal);

        vec3.set(triangleWorldPos, modelMatrix[12], modelMatrix[13], modelMatrix[14]);
        vec3.subtract(tempViewDir, cameraEye, triangleWorldPos);
        vec3.normalize(tempViewDir, tempViewDir);

        let cameraDot = vec3.dot(tempTransformedNormal, tempViewDir);
        if (cameraDot <= 0) {
            return;
        }

        let dot = vec3.dot(tempTransformedNormal, lightDir);
        let brightness = 0.2 + Math.max(0, dot) * 0.8;
        let colorValue = Math.floor(brightness * 255);
        let colorString = `rgb(${colorValue}, 0, 0)`;

        let screenVertices = this.vertices.map(function(vertex) {
            let localVec4 = vec4.fromValues(vertex.x, vertex.y, vertex.z, 1);

            vec4.transformMat4(tempClipVec4, localVec4, mvpMatrix);
            const [x, y, z, w] = tempClipVec4;

            let ndcX = x / w;
            let ndcY = y / w;

            let screenX = (ndcX + 1) * 0.5 * canvas.logicalWidth;
            let screenY = (-ndcY + 1) * 0.5 * canvas.logicalHeight;

            return { x: screenX, y: screenY };
        });

        context.beginPath();

        context.moveTo(screenVertices[0].x, screenVertices[0].y);
        context.lineTo(screenVertices[1].x, screenVertices[1].y);
        context.lineTo(screenVertices[2].x, screenVertices[2].y);

        context.closePath();
        context.fillStyle = colorString;
        context.lineWidth = 1;
        context.fill();
    }
}